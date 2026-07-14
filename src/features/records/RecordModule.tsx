"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { IonIcon } from "@ionic/react";
import { archiveOutline, copyOutline, createOutline, trashOutline } from "ionicons/icons";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useForm, type FieldValues, type UseFormRegister } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldShell, SelectInput, TextArea, TextInput } from "@/components/ui/form-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { ToastMessage } from "@/components/ui/toast-message";
import { buildLookupFields, resources, type FieldConfig, type LookupContext, type ResourceConfig } from "@/config/resources";
import { useAuth } from "@/lib/auth";
import { createRecord, useCreateRecord, useDeleteRecord, useRecords, useUpdateRecord } from "@/lib/repository";
import { canArchive, canCreate, canUpdate } from "@/services/permissions";
import type { AnyEntity, EntityMap, TableName } from "@/types/domain";
import { formatMoney, toTitle } from "@/utils/format";
import styles from "./RecordModule.module.css";

type ResourceKey = keyof typeof resources;

function safeString(value: unknown) {
  return value == null ? "" : String(value);
}

function duplicateMessage(table: TableName, records: AnyEntity[], values: Record<string, unknown>, editingId?: string) {
  const active = records.filter((record) => record.id !== editingId);
  if (table === "attendance") {
    const duplicate = active.find(
      (record) =>
        (record as EntityMap["attendance"]).site_id === values.site_id &&
        (record as EntityMap["attendance"]).labour_id === values.labour_id &&
        (record as EntityMap["attendance"]).date === values.date
    );
    return duplicate ? "Duplicate attendance exists for this labour, site, and date." : null;
  }
  if (table === "materials" && values.bill_number) {
    const duplicate = active.find((record) => (record as EntityMap["materials"]).bill_number === values.bill_number);
    return duplicate ? "A material bill with this bill number already exists." : null;
  }
  if (table === "extra_works") {
    const duplicate = active.find((record) => {
      const extra = record as EntityMap["extra_works"];
      return extra.site_id === values.site_id && extra.date === values.date && extra.description.toLowerCase() === safeString(values.description).toLowerCase();
    });
    return duplicate ? "A similar extra work entry already exists for this site and date." : null;
  }
  if (table === "partner_draws") {
    const duplicate = active.find((record) => {
      const draw = record as EntityMap["partner_draws"];
      return draw.partner_name.toLowerCase() === safeString(values.partner_name).toLowerCase() && draw.date === values.date && draw.amount === Number(values.amount || 0);
    });
    return duplicate ? "A similar partner draw already exists for this person, date, and amount." : null;
  }
  if (table === "labour") {
    const duplicate = active.find((record) => {
      const labour = record as EntityMap["labour"];
      return labour.mobile && values.mobile ? labour.mobile === values.mobile : labour.full_name.toLowerCase() === safeString(values.full_name).toLowerCase();
    });
    return duplicate ? "A similar labour profile already exists." : null;
  }
  return null;
}

function autoCalculate(table: TableName, values: Record<string, unknown>) {
  const next = { ...values };
  if (table === "materials") {
    next.total = Number(next.quantity || 0) * Number(next.rate || 0);
  }
  if (table === "attendance") {
    const wage = Number(next.daily_wage || 0);
    const overtime = Number(next.overtime_hours || 0);
    const base = next.status === "absent" ? 0 : next.status === "half_day" ? wage / 2 : wage;
    next.wage_amount = Math.round(base + overtime * (wage / 8));
  }
  if (table === "client_payments") {
    next.pending_amount = Math.max(0, Number(next.contract_amount || 0) - Number(next.received_amount || 0));
  }
  if (table === "extra_works") {
    next.amount = Number(next.quantity || 0) * Number(next.rate || 0);
  }
  return next;
}

function siteSummary(site: EntityMap["sites"], companyName?: string) {
  return [
    companyName || "H&H SPACES",
    `Site: ${site.name}`,
    `Client: ${site.client_name || "Client"}`,
    `Status: ${toTitle(site.status || "active")}`,
    `Budget: ${formatMoney(site.budget)}`,
    `Progress: ${Number(site.progress_percent || 0)}%`,
    `Work: ${site.work_type || "General"}`,
    `Address: ${site.address || "Not added"}`
  ].join("\n");
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const element = document.createElement("textarea");
  element.value = text;
  element.setAttribute("readonly", "true");
  element.style.position = "fixed";
  element.style.left = "-9999px";
  document.body.appendChild(element);
  element.select();
  document.execCommand("copy");
  document.body.removeChild(element);
}

function FieldInput({ field, register, error }: { field: FieldConfig; register: UseFormRegister<FieldValues>; error?: string }) {
  const common = register(field.name);
  if (field.type === "textarea") {
    return (
      <FieldShell label={field.label} error={error} helper={field.helper}>
        <TextArea rows={field.rows || 3} {...common} />
      </FieldShell>
    );
  }
  if (field.type === "select") {
    return (
      <FieldShell label={field.label} error={error} helper={field.helper}>
        <SelectInput {...common}>
          <option value="">Select {field.label}</option>
          {(field.options || []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FieldShell>
    );
  }
  return (
    <FieldShell label={field.label} error={error} helper={field.helper}>
      <TextInput type={field.type === "number" ? "number" : field.type} step={field.type === "number" ? "0.01" : undefined} {...common} />
    </FieldShell>
  );
}

function RecordModuleInner({ resourceKey }: { resourceKey: ResourceKey }) {
  const config = resources[resourceKey] as ResourceConfig;
  const table = config.table;
  const { company, user, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AnyEntity | null>(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const sitesQuery = useRecords("sites", company?.id);
  const labourQuery = useRecords("labour", company?.id);
  const suppliersQuery = useRecords("suppliers", company?.id);
  const recordsQuery = useRecords(table, company?.id);
  const createMutation = useCreateRecord(table, company?.id);
  const updateMutation = useUpdateRecord(table, company?.id);
  const deleteMutation = useDeleteRecord(table, company?.id);

  const lookups = useMemo<LookupContext>(
    () => ({
      sites: (sitesQuery.data || []).map((site) => ({ id: site.id, name: site.name, client_name: site.client_name })),
      labour: (labourQuery.data || []).map((item) => ({ id: item.id, full_name: item.full_name, work_type: item.work_type })),
      suppliers: (suppliersQuery.data || []).map((item) => ({ id: item.id, name: item.name }))
    }),
    [labourQuery.data, sitesQuery.data, suppliersQuery.data]
  );

  const fields = useMemo(() => buildLookupFields(config.fields, lookups), [config.fields, lookups]);
  const defaultValues = useMemo(() => config.defaults(), [config]);
  const schema = config.schema as z.ZodTypeAny;
  const form = useForm<FieldValues>({
    resolver: zodResolver(schema as any) as any,
    defaultValues: defaultValues as Record<string, unknown>,
    mode: "onBlur"
  });

  useEffect(() => {
    const requested =
      searchParams.get("add") === "1" ||
      (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("add") === "1");
    if (!requested || open) return;
    setEditing(null);
    form.reset(defaultValues as Record<string, unknown>);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname);
      window.setTimeout(() => setOpen(true), 80);
    } else {
      router.replace(pathname);
      setOpen(true);
    }
  }, [defaultValues, form, open, pathname, router, searchParams]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("record-sheet-open", open);
    return () => document.body.classList.remove("record-sheet-open");
  }, [open]);

  const records = (recordsQuery.data || []) as AnyEntity[];
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return records;
    return records.filter((row) => config.searchText(row as any, lookups).toLowerCase().includes(term));
  }, [config, lookups, query, records]);

  const startAdd = () => {
    setWarning(null);
    setEditing(null);
    form.reset(defaultValues as Record<string, unknown>);
    setOpen(true);
  };

  const startEdit = (record: AnyEntity) => {
    setWarning(null);
    setEditing(record);
    form.reset(record as unknown as Record<string, unknown>);
    setOpen(true);
  };

  const submit = form.handleSubmit(
    async (raw) => {
      const values = autoCalculate(table, raw);
      const duplicate = duplicateMessage(table, records, values, editing?.id);
      if (duplicate && !warning) {
        setWarning(`${duplicate} Submit again only if this is intentional.`);
        return;
      }

      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, values: values as never, userId: user?.id || null });
        setToast(`${config.title} updated`);
      } else {
        const saved = await createMutation.mutateAsync({ values: values as never, userId: user?.id || null, source: "manual" });
        if (company?.id) {
          await createRecord("activity_logs", company.id, {
            site_id: safeString(values.site_id) || null,
            entity_table: table,
            entity_id: (saved as { id: string }).id,
            action: "create",
            description: `${config.title} entry created`
          } as never, { userId: user?.id || null });
        }
        setToast(`${config.title} saved`);
      }
      setWarning(null);
      setOpen(false);
    },
    () => {
      setToast("Check the highlighted fields and try again");
    }
  );

  const archive = async (record: AnyEntity) => {
    const isSite = table === "sites";
    const confirmMessage = isSite
      ? "Delete this site from the active site list? Old linked entries stay safe for reports."
      : `Archive this ${config.title} record?`;
    if (!window.confirm(confirmMessage)) return;
    await deleteMutation.mutateAsync({ id: record.id, userId: user?.id || null });
    setToast(isSite ? "Site deleted" : "Record archived");
  };

  const copySummary = async (record: AnyEntity) => {
    if (table !== "sites") return;
    try {
      await copyText(siteSummary(record as EntityMap["sites"], company?.name));
      setToast("Site summary copied");
    } catch {
      setToast("Could not copy summary");
    }
  };

  const mayCreate = canCreate(role);
  const mayUpdate = canUpdate(role);
  const mayArchive = canArchive(role, table);

  return (
    <section className={styles.stack}>
      <div className={styles.hero}>
        <h2>{config.title}</h2>
        <p>{config.subtitle}</p>
      </div>

      {!mayCreate ? <div className={styles.permission}>Viewer mode: you can read records but cannot add or edit entries.</div> : null}

      <div className={styles.toolbar}>
        <input className={styles.search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${config.title.toLowerCase()}`} />
        <Button onClick={startAdd} disabled={!mayCreate}>
          {config.addLabel}
        </Button>
      </div>

      {recordsQuery.isLoading ? (
        <div className={styles.list}>
          <Skeleton style={{ height: 132 }} />
          <Skeleton style={{ height: 132 }} />
          <Skeleton style={{ height: 132 }} />
        </div>
      ) : filtered.length ? (
        <div className={styles.list}>
          {filtered.map((row) => {
            const amount = config.amount?.(row as any);
            const status = safeString((row as Record<string, unknown>).status || (row as Record<string, unknown>).payment_status);
            return (
              <Card key={row.id} className={styles.record}>
                <div className={styles.rowTop}>
                  <div>
                    <h3>{config.cardTitle(row as any, lookups)}</h3>
                    <p>{config.cardSubtitle(row as any, lookups)}</p>
                  </div>
                  {typeof amount === "number" ? <strong className={styles.amount}>{table === "progress_updates" ? `${amount}%` : formatMoney(amount)}</strong> : null}
                </div>
                <div className={styles.meta}>
                  {status ? <Badge tone={status.includes("paid") || status === "active" || status === "present" ? "success" : status.includes("over") || status === "absent" ? "danger" : "info"}>{toTitle(status)}</Badge> : null}
                  <Badge tone={(row as AnyEntity).sync_status === "pending" ? "warning" : "neutral"}>{toTitle((row as AnyEntity).sync_status)}</Badge>
                </div>
                <div className={`${styles.actions} ${table === "sites" ? styles.siteActions : ""}`}>
                  {table === "sites" ? (
                    <Button variant="success" className={styles.copyAction} onClick={() => copySummary(row)} icon={<IonIcon icon={copyOutline} />}>
                      Copy Summary
                    </Button>
                  ) : null}
                  <Button variant="secondary" onClick={() => startEdit(row)} disabled={!mayUpdate} icon={<IonIcon icon={createOutline} />}>
                    Edit
                  </Button>
                  <Button
                    variant={table === "sites" ? "danger" : "ghost"}
                    onClick={() => archive(row)}
                    disabled={!mayArchive}
                    icon={<IonIcon icon={table === "sites" ? trashOutline : mayArchive ? archiveOutline : trashOutline} />}
                  >
                    {table === "sites" ? "Delete Site" : "Archive"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState title={`No ${config.title.toLowerCase()} yet`} description={`Tap ${config.addLabel} to create the first working record. Offline entries will sync when internet returns.`} />
      )}

      {open ? (
        <div className={styles.sheetOverlay} role="dialog" aria-modal="true" aria-label={editing ? `Edit ${config.title}` : config.addLabel}>
          <button className={styles.sheetBackdrop} type="button" aria-label={`Close ${config.title} form`} onClick={() => setOpen(false)} />
          <div className={styles.sheet}>
          <div className={styles.handle} />
          <h2 className={styles.heroTitle}>{editing ? `Edit ${config.title}` : config.addLabel}</h2>
          <form className={styles.form} onSubmit={submit}>
            {warning ? <div className={styles.warning}>{warning}</div> : null}
            {fields.map((field) => (
              <FieldInput
                key={field.name}
                field={field}
                register={form.register}
                error={safeString(form.formState.errors[field.name]?.message)}
              />
            ))}
            <div className={styles.stickySave}>
              <Button type="submit" full disabled={form.formState.isSubmitting || (editing ? !mayUpdate : !mayCreate)}>
                {form.formState.isSubmitting ? "Saving..." : editing ? "Save Changes" : "Save Entry"}
              </Button>
              <Button type="button" full variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
        </div>
      ) : null}

      <ToastMessage message={toast} duration={2200} tone="success" onDismiss={() => setToast(null)} />
    </section>
  );
}

export function RecordModule({ resourceKey }: { resourceKey: ResourceKey }) {
  return (
    <Suspense
      fallback={
        <section className={styles.stack}>
          <Skeleton style={{ height: 140 }} />
          <Skeleton style={{ height: 54 }} />
          <Skeleton style={{ height: 132 }} />
        </section>
      }
    >
      <RecordModuleInner resourceKey={resourceKey} />
    </Suspense>
  );
}
