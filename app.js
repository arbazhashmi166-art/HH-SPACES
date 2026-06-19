const STORAGE_KEY = "site-ledger-data-v1";

const state = loadState();
const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);

const views = {
  dashboard: "Dashboard",
  sites: "Sites & Clients",
  wages: "Labour Wages",
  materials: "Material Expenses",
  payments: "Client Payments",
  bills: "Pending Payment Bills",
  progress: "Work Progress",
  updates: "Daily Updates"
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('input[type="date"]').forEach((input) => {
    input.value = today;
  });
  document.getElementById("monthFilter").value = currentMonth;

  bindNavigation();
  bindForms();
  bindActions();
  render();
});

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    return JSON.parse(saved);
  }

  return {
    sites: [],
    wages: [],
    materials: [],
    payments: [],
    bills: [],
    progress: [],
    updates: []
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function bindNavigation() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(button.dataset.view).classList.add("active");
      document.getElementById("viewTitle").textContent = views[button.dataset.view];
    });
  });

  document.getElementById("siteFilter").addEventListener("change", render);
  document.getElementById("monthFilter").addEventListener("change", render);
}

function bindForms() {
  bindForm("siteForm", (data) => {
    state.sites.push({
      id: makeId(),
      name: data.name,
      client: data.client,
      phone: data.phone,
      location: data.location,
      contract: number(data.contract),
      startDate: data.startDate,
      status: data.status
    });
  });

  bindForm("wageForm", (data) => {
    state.wages.push({
      id: makeId(),
      date: data.date,
      siteId: data.siteId,
      worker: data.worker,
      workType: data.workType,
      days: number(data.days),
      rate: number(data.rate),
      amount: number(data.days) * number(data.rate)
    });
  });

  bindForm("materialForm", (data) => {
    state.materials.push({
      id: makeId(),
      date: data.date,
      siteId: data.siteId,
      item: data.item,
      supplier: data.supplier,
      billNo: data.billNo,
      amount: number(data.amount)
    });
  });

  bindForm("paymentForm", (data) => {
    const site = findSite(data.siteId);
    state.payments.push({
      id: makeId(),
      date: data.date,
      siteId: data.siteId,
      client: data.client || site.client,
      mode: data.mode,
      reference: data.reference,
      amount: number(data.amount)
    });
  });

  bindForm("billForm", (data) => {
    state.bills.push({
      id: makeId(),
      date: data.date,
      dueDate: data.dueDate,
      siteId: data.siteId,
      party: data.party,
      detail: data.detail,
      amount: number(data.amount),
      status: "Pending"
    });
  });

  bindForm("progressForm", (data) => {
    state.progress.push({
      id: makeId(),
      date: data.date,
      siteId: data.siteId,
      stage: data.stage,
      percent: clamp(number(data.percent), 0, 100),
      notes: data.notes
    });
  });

  bindForm("updateForm", (data) => {
    state.updates.push({
      id: makeId(),
      date: data.date,
      siteId: data.siteId,
      labourCount: number(data.labourCount),
      weather: data.weather,
      workDone: data.workDone,
      nextPlan: data.nextPlan
    });
  });
}

function bindForm(formId, onSubmit) {
  const form = document.getElementById(formId);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.sites.length && formId !== "siteForm") {
      alert("Add at least one site first.");
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    onSubmit(data);
    saveState();
    form.reset();
    form.querySelectorAll('input[type="date"]').forEach((input) => {
      input.value = today;
    });
    const days = form.querySelector('input[name="days"]');
    if (days) days.value = 1;
    render();
  });
}

function bindActions() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete]");
    if (!button) return;
    const [collection, id] = button.dataset.delete.split(":");
    state[collection] = state[collection].filter((item) => item.id !== id);
    saveState();
    render();
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-paid]");
    if (!button) return;
    const bill = state.bills.find((item) => item.id === button.dataset.paid);
    if (bill) {
      bill.status = "Paid";
      saveState();
      render();
    }
  });

  document.getElementById("resetDemo").addEventListener("click", () => {
    if (!confirm("Clear all saved data from this browser?")) return;
    Object.keys(state).forEach((key) => {
      state[key] = [];
    });
    saveState();
    render();
  });

  document.getElementById("printReport").addEventListener("click", () => window.print());
  document.getElementById("exportCsv").addEventListener("click", exportCsv);
}

function render() {
  renderSiteFilter();
  renderSiteSelects();
  renderDashboard();
  renderSites();
  renderWages();
  renderMaterials();
  renderPayments();
  renderBills();
  renderProgress();
  renderUpdates();
}

function renderSiteFilter() {
  const filter = document.getElementById("siteFilter");
  const selected = filter.value || "all";
  filter.innerHTML = '<option value="all">All sites</option>' + state.sites
    .map((site) => `<option value="${site.id}">${escapeHtml(site.name)}</option>`)
    .join("");
  filter.value = state.sites.some((site) => site.id === selected) ? selected : "all";
}

function renderSiteSelects() {
  const options = state.sites.length
    ? state.sites.map((site) => `<option value="${site.id}">${escapeHtml(site.name)} - ${escapeHtml(site.client)}</option>`).join("")
    : '<option value="">Add a site first</option>';

  document.querySelectorAll('select[name="siteId"]').forEach((select) => {
    const current = select.value;
    select.innerHTML = options;
    if (state.sites.some((site) => site.id === current)) {
      select.value = current;
    }
  });
}

function renderDashboard() {
  const wages = filtered(state.wages);
  const materials = filtered(state.materials);
  const payments = filtered(state.payments);
  const bills = filtered(state.bills).filter((bill) => bill.status !== "Paid");

  document.getElementById("metricWages").textContent = formatMoney(sum(wages, "amount"));
  document.getElementById("metricMaterials").textContent = formatMoney(sum(materials, "amount"));
  document.getElementById("metricPayments").textContent = formatMoney(sum(payments, "amount"));
  document.getElementById("metricBills").textContent = formatMoney(sum(bills, "amount"));

  const rows = visibleSites().map((site) => {
    const contract = number(site.contract);
    const paid = sum(state.payments.filter((item) => item.siteId === site.id), "amount");
    const balance = contract ? contract - paid : 0;
    const progress = latestProgress(site.id);
    return `<tr>
      <td><strong>${escapeHtml(site.name)}</strong><br><span>${escapeHtml(site.location || "")}</span></td>
      <td>${escapeHtml(site.client)}</td>
      <td>${progressCell(progress.percent, progress.stage)}</td>
      <td class="amount">${contract ? formatMoney(balance) : "-"}</td>
    </tr>`;
  }).join("");
  document.getElementById("siteSummaryRows").innerHTML = rows || emptyRow(4);

  const updates = filtered(state.updates)
    .sort(byDateDesc)
    .slice(0, 5)
    .map(updateCard)
    .join("");
  document.getElementById("latestUpdates").innerHTML = updates || emptyCard("No daily updates yet.");
}

function renderSites() {
  const rows = visibleSites().map((site) => `<tr>
    <td><strong>${escapeHtml(site.name)}</strong><br><span>${escapeHtml(site.location || "")}</span></td>
    <td>${escapeHtml(site.client)}</td>
    <td>${escapeHtml(site.phone || "-")}</td>
    <td class="amount">${site.contract ? formatMoney(site.contract) : "-"}</td>
    <td>${escapeHtml(site.status)}</td>
    <td><button class="delete-btn" data-delete="sites:${site.id}" type="button">Delete</button></td>
  </tr>`).join("");
  document.getElementById("siteRows").innerHTML = rows || emptyRow(6);
}

function renderWages() {
  const rows = filtered(state.wages).sort(byDateDesc).map((wage) => `<tr>
    <td>${dateText(wage.date)}</td>
    <td>${siteName(wage.siteId)}</td>
    <td>${escapeHtml(wage.worker)}</td>
    <td>${escapeHtml(wage.workType || "-")}</td>
    <td>${wage.days}</td>
    <td class="amount">${formatMoney(wage.amount)}</td>
    <td><button class="delete-btn" data-delete="wages:${wage.id}" type="button">Delete</button></td>
  </tr>`).join("");
  document.getElementById("wageRows").innerHTML = rows || emptyRow(7);
}

function renderMaterials() {
  const rows = filtered(state.materials).sort(byDateDesc).map((item) => `<tr>
    <td>${dateText(item.date)}</td>
    <td>${siteName(item.siteId)}</td>
    <td>${escapeHtml(item.item)}</td>
    <td>${escapeHtml(item.supplier || "-")}</td>
    <td>${escapeHtml(item.billNo || "-")}</td>
    <td class="amount">${formatMoney(item.amount)}</td>
    <td><button class="delete-btn" data-delete="materials:${item.id}" type="button">Delete</button></td>
  </tr>`).join("");
  document.getElementById("materialRows").innerHTML = rows || emptyRow(7);
}

function renderPayments() {
  const rows = filtered(state.payments).sort(byDateDesc).map((payment) => `<tr>
    <td>${dateText(payment.date)}</td>
    <td>${siteName(payment.siteId)}</td>
    <td>${escapeHtml(payment.client || "-")}</td>
    <td>${escapeHtml(payment.mode)}</td>
    <td>${escapeHtml(payment.reference || "-")}</td>
    <td class="amount">${formatMoney(payment.amount)}</td>
    <td><button class="delete-btn" data-delete="payments:${payment.id}" type="button">Delete</button></td>
  </tr>`).join("");
  document.getElementById("paymentRows").innerHTML = rows || emptyRow(7);
}

function renderBills() {
  const rows = filtered(state.bills).filter((bill) => bill.status !== "Paid").sort(byDateDesc).map((bill) => `<tr>
    <td>${dateText(bill.date)}</td>
    <td>${bill.dueDate ? dateText(bill.dueDate) : "-"}</td>
    <td>${siteName(bill.siteId)}</td>
    <td>${escapeHtml(bill.party)}</td>
    <td>${escapeHtml(bill.detail || "-")}</td>
    <td class="amount">${formatMoney(bill.amount)}</td>
    <td>
      <button class="paid-btn" data-paid="${bill.id}" type="button">Paid</button>
      <button class="delete-btn" data-delete="bills:${bill.id}" type="button">Delete</button>
    </td>
  </tr>`).join("");
  document.getElementById("billRows").innerHTML = rows || emptyRow(7);
}

function renderProgress() {
  const rows = filtered(state.progress).sort(byDateDesc).map((item) => `<tr>
    <td>${dateText(item.date)}</td>
    <td>${siteName(item.siteId)}</td>
    <td>${escapeHtml(item.stage)}</td>
    <td>${progressCell(item.percent, "")}</td>
    <td>${escapeHtml(item.notes || "-")}</td>
    <td><button class="delete-btn" data-delete="progress:${item.id}" type="button">Delete</button></td>
  </tr>`).join("");
  document.getElementById("progressRows").innerHTML = rows || emptyRow(6);
}

function renderUpdates() {
  const rows = filtered(state.updates).sort(byDateDesc).map(updateCard).join("");
  document.getElementById("updateRows").innerHTML = rows || emptyCard("No daily updates yet.");
}

function updateCard(update) {
  return `<article class="activity-card">
    <header>
      <div>
        <h4>${siteName(update.siteId)}</h4>
        <time>${dateText(update.date)} | Labour: ${update.labourCount || 0} | ${escapeHtml(update.weather || "Weather not set")}</time>
      </div>
      <button class="delete-btn" data-delete="updates:${update.id}" type="button">Delete</button>
    </header>
    <p><strong>Done:</strong> ${escapeHtml(update.workDone)}</p>
    <p><strong>Next:</strong> ${escapeHtml(update.nextPlan || "-")}</p>
  </article>`;
}

function filtered(collection) {
  const siteId = document.getElementById("siteFilter")?.value || "all";
  const month = document.getElementById("monthFilter")?.value || "";
  return collection.filter((item) => {
    const siteMatch = siteId === "all" || item.siteId === siteId || item.id === siteId;
    const monthMatch = !month || !item.date || item.date.startsWith(month) || item.startDate?.startsWith(month);
    return siteMatch && monthMatch;
  });
}

function visibleSites() {
  const siteId = document.getElementById("siteFilter")?.value || "all";
  return state.sites.filter((site) => siteId === "all" || site.id === siteId);
}

function latestProgress(siteId) {
  const latest = state.progress.filter((item) => item.siteId === siteId).sort(byDateDesc)[0];
  return latest || { percent: 0, stage: "Not started" };
}

function progressCell(percent, stage) {
  const safePercent = clamp(number(percent), 0, 100);
  return `<div><strong>${safePercent}%</strong> ${escapeHtml(stage || "")}<div class="progress-track"><div class="progress-bar" style="width:${safePercent}%"></div></div></div>`;
}

function exportCsv() {
  const sections = [
    ["sites", state.sites],
    ["wages", state.wages],
    ["materials", state.materials],
    ["payments", state.payments],
    ["pending_bills", state.bills],
    ["progress", state.progress],
    ["daily_updates", state.updates]
  ];

  const csv = sections.map(([name, rows]) => {
    if (!rows.length) return `${name}\nNo records\n`;
    const headers = Object.keys(rows[0]);
    const lines = rows.map((row) => headers.map((header) => csvCell(row[header])).join(","));
    return `${name}\n${headers.join(",")}\n${lines.join("\n")}\n`;
  }).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `site-ledger-${today}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function siteName(siteId) {
  return escapeHtml(findSite(siteId).name || "Unknown site");
}

function findSite(siteId) {
  return state.sites.find((site) => site.id === siteId) || {};
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + number(row[key]), 0);
}

function number(value) {
  return Number(value) || 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function byDateDesc(a, b) {
  return String(b.date || "").localeCompare(String(a.date || ""));
}

function formatMoney(value) {
  return moneyFormatter.format(number(value));
}

function dateText(value) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year}`;
}

function emptyRow(cols) {
  return `<tr><td colspan="${cols}" class="empty">No records yet.</td></tr>`;
}

function emptyCard(text) {
  return `<div class="activity-card"><p>${escapeHtml(text)}</p></div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
