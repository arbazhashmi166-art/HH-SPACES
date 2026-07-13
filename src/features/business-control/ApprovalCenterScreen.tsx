"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ToastMessage } from "@/components/ui/toast-message";
import { useAuth } from "@/lib/auth";
import { createRecord, useCreateRecord, useRecords, useUpdateRecord } from "@/lib/repository";
import type { ApprovalCategory, ApprovalRequest, TableName } from "@/types/domain";
import { formatMoney, todayIso, toTitle } from "@/utils/format";
import styles from "./BusinessControl.module.css";

const categories: ApprovalCategory[] = ["partner_draw", "extra_work", "supplier_payment", "client_payment", "expense", "other"];

type ApprovalForm = {
  site_id: string;
  category: ApprovalCategory;
  title: string;
  amount: string;
  requested_by_name: string;
  linked_table: "" | TableName;
  linked_record_id: string;
  decision_notes: string;
};

function blankForm(name = ""): ApprovalForm {
  return {
    site_id: "",
    category: "expense",
    title: "",
    amount: "",
    requested_by_name: name,
    linked_table: "",
    linked_record_id: "",
    decision_notes: ""
  };
}

function approvalTone(status: ApprovalRequest["status"]) {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

export function ApprovalCenterScreen() {
  const { company, user, profile } = useAuth();
  const requesterName = profile?.full_name || user?.email || "";
  const [form, setForm] = useState<ApprovalForm>(() => blankForm(requesterName));
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const sites = useRecords("sites", company?.id);
  const approvals = useRecords("approval_requests", company?.id);
  const partnerDraws = useRecords("partner_draws", company?.id);
  const extraWorks = useRecords("extra_works", company?.id);
  const supplierPayments = useRecords("supplier_payments", company?.id);
  const createApproval = useCreateRecord("approval_requests", company?.id);
  const updateApproval = useUpdateRecord("approval_requests", company?.id);

  const rows = approvals.data || [];
  const pending = rows.filter((item) => item.status === "pending");
  const decided = rows.filter((item) => item.status !== "pending");
  const pendingAmount = pending.reduce((total, item) => total + Number(item.amount || 0), 0);

  const suggestions = useMemo(
    () => [
      ...(partnerDraws.data || [])
        .filter((item) => Number(item.amount || 0) >= 10000)
        .slice(0, 3)
        .map((item) => ({
          key: item.id,
          label: `Approve ${item.partner_name} draw`,
          amount: Number(item.amount || 0),
          category: "partner_draw" as ApprovalCategory,
          site_id: item.site_id || "",
          title: `${item.partner_name} ${toTitle(item.category)} ${formatMoney(item.amount)}`,
          linked_table: "partner_draws" as TableName,
          linked_record_id: item.id
        })),
      ...(extraWorks.data || [])
        .filter((item) => item.status === "draft" || !item.client_approved)
        .slice(0, 3)
        .map((item) => ({
          key: item.id,
          label: `Approve extra work`,
          amount: Number(item.amount || 0),
          category: "extra_work" as ApprovalCategory,
          site_id: item.site_id,
          title: `${item.work_type} extra work ${formatMoney(item.amount)}`,
          linked_table: "extra_works" as TableName,
          linked_record_id: item.id
        })),
      ...(supplierPayments.data || [])
        .filter((item) => Number(item.pending_amount || 0) > 0)
        .slice(0, 3)
        .map((item) => ({
          key: item.id,
          label: `Approve supplier payment`,
          amount: Number(item.pending_amount || 0),
          category: "supplier_payment" as ApprovalCategory,
          site_id: item.site_id || "",
          title: `Supplier pending ${formatMoney(item.pending_amount)}`,
          linked_table: "supplier_payments" as TableName,
          linked_record_id: item.id
        }))
    ],
    [extraWorks.data, partnerDraws.data, supplierPayments.data]
  );

  const updateForm = <K extends keyof ApprovalForm>(key: K, value: ApprovalForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const fillSuggestion = (suggestion: (typeof suggestions)[number]) => {
    setForm({
      site_id: suggestion.site_id,
      category: suggestion.category,
      title: suggestion.title,
      amount: String(suggestion.amount),
      requested_by_name: requesterName,
      linked_table: suggestion.linked_table,
      linked_record_id: suggestion.linked_record_id,
      decision_notes: ""
    });
    setToast("Approval draft loaded");
  };

  const submit = async () => {
    const amount = Number(form.amount || 0);
    if (!form.title.trim()) {
      setToast("Enter approval title");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setToast("Enter approval amount");
      return;
    }
    const saved = await createApproval.mutateAsync({
      values: {
        site_id: form.site_id || null,
        category: form.category,
        title: form.title.trim(),
        amount,
        requested_by_name: form.requested_by_name || requesterName || null,
        approver_name: null,
        status: "pending",
        linked_table: form.linked_table || null,
        linked_record_id: form.linked_record_id || null,
        decision_notes: form.decision_notes || null,
        decided_at: null
      },
      userId: user?.id || null,
      source: "manual"
    });
    if (company?.id) {
      await createRecord(
        "activity_logs",
        company.id,
        {
          site_id: form.site_id || null,
          entity_table: "approval_requests",
          entity_id: saved.id,
          action: "create",
          description: `Approval requested: ${form.title.trim()}`
        },
        { userId: user?.id || null }
      );
    }
    setForm(blankForm(requesterName));
    setToast("Approval request saved");
  };

  const decide = async (item: ApprovalRequest, status: ApprovalRequest["status"]) => {
    if (status === "pending") return;
    const note = decisionNotes[item.id] || (status === "approved" ? "Approved" : "Rejected");
    await updateApproval.mutateAsync({
      id: item.id,
      values: {
        status,
        approver_name: profile?.full_name || user?.email || "Admin",
        decision_notes: note,
        decided_at: new Date().toISOString()
      },
      userId: user?.id || null,
      source: "manual"
    });
    if (company?.id) {
      await createRecord(
        "activity_logs",
        company.id,
        {
          site_id: item.site_id,
          entity_table: "approval_requests",
          entity_id: item.id,
          action: "update",
          description: `Approval ${status}: ${item.title}`
        },
        { userId: user?.id || null }
      );
    }
    setToast(`Request ${status}`);
  };

  return (
    <section className={styles.stack}>
      <div className={styles.hero}>
        <span>Approval Center</span>
        <h2>{formatMoney(pendingAmount)}</h2>
        <p>{pending.length} requests need a decision before money, extra work, or supplier action is finalized.</p>
        <div className={styles.heroActions}>
          <Button onClick={submit} disabled={createApproval.isPending}>Save Request</Button>
          <Button variant="secondary" onClick={() => setForm(blankForm(requesterName))}>Clear</Button>
        </div>
      </div>

      <div className={styles.grid}>
        <Card className={styles.miniCard}>
          <span>Pending</span>
          <strong>{pending.length}</strong>
          <Badge tone={pending.length ? "warning" : "success"}>{pending.length ? "Decide" : "Clear"}</Badge>
        </Card>
        <Card className={styles.miniCard}>
          <span>Decided</span>
          <strong>{decided.length}</strong>
          <Badge tone="info">History</Badge>
        </Card>
      </div>

      <Card>
        <CardHeader title="Create Approval" subtitle="Use this before partner cash, extra work, supplier payment, or any risky expense." />
        <div className={styles.fieldGrid}>
          <select className={styles.select} value={form.site_id} onChange={(event) => updateForm("site_id", event.target.value)}>
            <option value="">Company level / no site</option>
            {(sites.data || []).map((site) => (
              <option value={site.id} key={site.id}>{site.name}</option>
            ))}
          </select>
          <select className={styles.select} value={form.category} onChange={(event) => updateForm("category", event.target.value as ApprovalCategory)}>
            {categories.map((category) => (
              <option value={category} key={category}>{toTitle(category)}</option>
            ))}
          </select>
          <input className={styles.input} value={form.title} onChange={(event) => updateForm("title", event.target.value)} placeholder="Approval title" />
          <input className={styles.input} type="number" inputMode="decimal" value={form.amount} onChange={(event) => updateForm("amount", event.target.value)} placeholder="Amount" />
          <input className={styles.input} value={form.requested_by_name} onChange={(event) => updateForm("requested_by_name", event.target.value)} placeholder="Requested by" />
          <textarea className={styles.textarea} value={form.decision_notes} onChange={(event) => updateForm("decision_notes", event.target.value)} placeholder="Reason / notes" />
        </div>
      </Card>

      {suggestions.length ? (
        <Card>
          <CardHeader title="Smart Approval Drafts" subtitle="High-value records found by the app. Tap one to create a request." />
          <div className={styles.smartList}>
            {suggestions.map((suggestion) => (
              <button className={styles.smartCard} type="button" key={suggestion.key} onClick={() => fillSuggestion(suggestion)}>
                <div className={styles.itemTop}>
                  <strong>{suggestion.label}</strong>
                  <Badge tone="warning">{formatMoney(suggestion.amount)}</Badge>
                </div>
                <p>{suggestion.title}</p>
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Pending Decisions" subtitle="Approve or reject with a note so the audit trail stays clear." />
        {pending.length ? (
          <div className={styles.smartList}>
            {pending.map((item) => (
              <div className={styles.smartCard} key={item.id}>
                <div className={styles.itemTop}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{toTitle(item.category)} | {item.requested_by_name || "Requester not set"}</p>
                  </div>
                  <Badge tone="warning">{formatMoney(item.amount)}</Badge>
                </div>
                <textarea
                  className={styles.textarea}
                  value={decisionNotes[item.id] || ""}
                  onChange={(event) => setDecisionNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                  placeholder="Decision note"
                />
                <div className={styles.buttonRow}>
                  <Button variant="success" onClick={() => decide(item, "approved")} disabled={updateApproval.isPending}>Approve</Button>
                  <Button variant="danger" onClick={() => decide(item, "rejected")} disabled={updateApproval.isPending}>Reject</Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No pending approvals" description="Approval requests for partner money, extra work, and supplier dues will appear here." />
        )}
      </Card>

      <Card>
        <CardHeader title="Decision History" subtitle="Approved and rejected requests stay visible for business clarity." />
        {decided.length ? (
          <div className={styles.smartList}>
            {decided.slice(0, 12).map((item) => (
              <div className={styles.smartCard} key={item.id}>
                <div className={styles.itemTop}>
                  <strong>{item.title}</strong>
                  <Badge tone={approvalTone(item.status)}>{toTitle(item.status)}</Badge>
                </div>
                <p>{formatMoney(item.amount)} | {item.approver_name || "No approver"} | {item.decided_at ? item.decided_at.slice(0, 10) : todayIso()}</p>
                {item.decision_notes ? <p>{item.decision_notes}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No decisions yet" description="Approved and rejected requests will build a clean audit history." />
        )}
      </Card>

      <ToastMessage message={toast} duration={2400} onDismiss={() => setToast(null)} />
    </section>
  );
}
