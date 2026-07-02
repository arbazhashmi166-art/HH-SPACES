import { formatMoney } from "@/utils/format";

export type ReportRow = Record<string, string | number | null | undefined>;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function exportCsv(rows: ReportRow[], filename: string) {
  const headers = Object.keys(rows[0] || { status: "No data" });
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header] ?? "";
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(",")
    )
  ].join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}

export function exportExcel(rows: ReportRow[], filename: string) {
  const headers = Object.keys(rows[0] || { status: "No data" });
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><table><thead><tr>${headers
    .map((header) => `<th>${header}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${headers.map((header) => `<td>${row[header] ?? ""}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></body></html>`;
  downloadBlob(new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" }), filename);
}

export async function exportPdf({
  title,
  subtitle,
  rows,
  filename
}: {
  title: string;
  subtitle: string;
  rows: ReportRow[];
  filename: string;
}) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const headers = Object.keys(rows[0] || { status: "No data" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 40, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(subtitle, 40, 62);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 40, 78);

  autoTable(doc, {
    startY: 96,
    head: [headers],
    body: rows.map((row) => headers.map((header) => row[header] ?? "")),
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [59, 91, 255] }
  });

  doc.save(filename);
}

export function moneyRow(label: string, value: number) {
  return { item: label, amount: formatMoney(value) };
}
