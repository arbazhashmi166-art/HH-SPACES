"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ToastMessage } from "@/components/ui/toast-message";
import { useAuth } from "@/lib/auth";
import { createRecord } from "@/lib/repository";
import { useRecords } from "@/lib/repository";
import { supabase } from "@/lib/supabase";
import { parseLocalAiDraft, type AiDraft } from "@/services/ai-parser";
import { formatMoney } from "@/utils/format";
import styles from "./AiAssistant.module.css";

type Message = { role: "user" | "assistant"; content: string; draft?: AiDraft };

const prompts = [
  "How much payment is pending?",
  "Bought 20 cement bags at 360 each for Kondhwa site",
  "Extra work waterproofing 500 sqft at 55",
  "Arbaz took 10000 emergency money from company",
  "5 labour present today, 700 per day, 1 absent, 1 half day",
  "Client paid 25000 cash for terrace work"
];

export function AiAssistant() {
  const { company, user } = useAuth();
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Ask business questions or type rough entries. I will prepare a structured draft and will not save anything until you confirm."
    }
  ]);
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const sites = useRecords("sites", company?.id);
  const clientPayments = useRecords("client_payments", company?.id);
  const supplierPayments = useRecords("supplier_payments", company?.id);
  const labour = useRecords("labour", company?.id);
  const expenses = useRecords("expenses", company?.id);
  const extraWorks = useRecords("extra_works", company?.id);
  const partnerDraws = useRecords("partner_draws", company?.id);

  const canSave = useMemo(() => Boolean(draft && draft.intent !== "unknown" && draft.missing_fields.length === 0), [draft]);

  function answerBusinessQuestion(input: string) {
    const lower = input.toLowerCase();
    if (lower.includes("pending payment") || lower.includes("payment is pending") || lower.includes("pending")) {
      const clientPending = (clientPayments.data || []).reduce((total, item) => total + item.pending_amount, 0);
      const supplierPending = (supplierPayments.data || []).reduce((total, item) => total + item.pending_amount, 0);
      const labourBalance = (labour.data || []).reduce((total, item) => total + item.balance_payment, 0);
      return `Pending summary from current records: client receivable ${formatMoney(clientPending)}, supplier payable ${formatMoney(supplierPending)}, labour balance ${formatMoney(labourBalance)}. Source records: ${clientPayments.data?.length || 0} client payments, ${supplierPayments.data?.length || 0} supplier payments, ${labour.data?.length || 0} labour profiles.`;
    }
    if (lower.includes("expense")) {
      const total = (expenses.data || []).reduce((sum, item) => sum + item.amount, 0);
      return `Total expenses from current records are ${formatMoney(total)} across ${expenses.data?.length || 0} entries.`;
    }
    if (lower.includes("extra work") || lower.includes("variation") || lower.includes("unbilled")) {
      const approved = (extraWorks.data || [])
        .filter((item) => item.client_approved || item.status === "approved" || item.status === "billed" || item.status === "paid")
        .reduce((sum, item) => sum + item.amount, 0);
      const unbilled = (extraWorks.data || [])
        .filter((item) => (item.client_approved || item.status === "approved") && item.status !== "billed" && item.status !== "paid")
        .reduce((sum, item) => sum + item.amount, 0);
      return `Extra work summary from current records: approved value ${formatMoney(approved)}, unbilled approved value ${formatMoney(unbilled)} across ${extraWorks.data?.length || 0} extra work entries.`;
    }
    if (lower.includes("partner") || lower.includes("money taken") || lower.includes("company money") || lower.includes("profit share") || lower.includes("draw")) {
      const totals = (partnerDraws.data || []).reduce<Record<string, number>>((items, item) => {
        items[item.partner_name] = (items[item.partner_name] || 0) + item.amount;
        return items;
      }, {});
      const summary = Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .map(([name, amount]) => `${name}: ${formatMoney(amount)}`)
        .join(", ");
      return `Partner/company money taken summary: ${summary || "No partner draw entries found."} Source records: ${partnerDraws.data?.length || 0} partner draw entries.`;
    }
    if (lower.includes("site") && lower.includes("active")) {
      const active = (sites.data || []).filter((site) => site.status === "active");
      return `Active sites: ${active.length}. ${active.map((site) => `${site.name} (${site.progress_percent}%)`).join(", ") || "No active sites found."}`;
    }
    return null;
  }

  async function ask(promptText = text) {
    const input = promptText.trim();
    if (!input) return;
    setBusy(true);
    setText("");
    setMessages((items) => [...items, { role: "user", content: input }]);

    try {
      const businessAnswer = answerBusinessQuestion(input);
      if (businessAnswer) {
        setDraft(null);
        setMessages((items) => [...items, { role: "assistant", content: businessAnswer }]);
        return;
      }
      let parsed: AiDraft | null = null;
      if (supabase) {
        const { data, error } = await supabase.functions.invoke("ai-assistant", {
          body: { message: input, company_id: company?.id }
        });
        if (!error && data?.draft) parsed = data.draft as AiDraft;
      }
      parsed ||= parseLocalAiDraft(input);
      setDraft(parsed);
      setMessages((items) => [...items, { role: "assistant", content: parsed.response, draft: parsed }]);

      if (company?.id) {
        await createRecord("ai_messages", company.id, {
          conversation_id: "local",
          role: "user",
          content: input,
          structured_json: parsed.draft,
          confidence: parsed.confidence,
          confirmed_at: null
        } as never, { userId: user?.id || null, source: "ai" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirmDraft() {
    if (!draft || !company?.id) return;
    if (!canSave) {
      setToast("Missing fields must be filled before saving.");
      return;
    }

    const map: Record<AiDraft["intent"], string | null> = {
      attendance: "attendance",
      material: "materials",
      expense: "expenses",
      client_payment: "client_payments",
      supplier_payment: "supplier_payments",
      partner_draw: "partner_draws",
      progress: "progress_updates",
      labour: "labour",
      reminder: "reminders",
      extra_work: "extra_works",
      unknown: null
    };
    const table = map[draft.intent];
    if (!table) return;
    const saved = await createRecord(table as never, company.id, draft.draft as never, { userId: user?.id || null, source: "ai" });
    await createRecord("activity_logs", company.id, {
      site_id: (draft.draft.site_id as string) || null,
      entity_table: table,
      entity_id: (saved as { id: string }).id,
      action: "ai_confirm",
      description: `AI confirmed ${draft.intent} entry`
    } as never, { userId: user?.id || null, source: "ai" });
    setToast("AI draft saved after confirmation");
    setDraft(null);
  }

  return (
    <section className={styles.stack}>
      <div className={styles.hero}>
        <h2>AI Site Manager</h2>
        <p>Structured drafts, business questions, payment follow-ups, reports, and memory. AI never writes to your data without confirmation.</p>
      </div>

      <Card>
        <CardHeader title="Suggested Prompts" subtitle="Use natural language. Add site names and amounts for better accuracy." />
        <div className={styles.promptGrid}>
          {prompts.map((prompt) => (
            <button key={prompt} className={styles.prompt} type="button" onClick={() => ask(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Chat" subtitle="History is saved locally and can be synced to Supabase." />
        <div className={styles.chat}>
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`${styles.bubble} ${message.role === "user" ? styles.user : styles.assistant}`}>
              {message.content}
            </div>
          ))}
        </div>
      </Card>

      {draft ? (
        <Card className={styles.draft}>
          <CardHeader
            title="Confirmation Draft"
            subtitle={`Intent: ${draft.intent}. Confidence: ${Math.round(draft.confidence * 100)}%. Missing: ${draft.missing_fields.join(", ") || "None"}.`}
            action={<Badge tone={draft.missing_fields.length ? "warning" : "success"}>{draft.missing_fields.length ? "Needs edit" : "Ready"}</Badge>}
          />
          <pre className={styles.json}>{JSON.stringify(draft.draft, null, 2)}</pre>
          <Button onClick={confirmDraft} disabled={!canSave}>
            Confirm and Save
          </Button>
          <Button variant="secondary" onClick={() => setDraft(null)}>
            Cancel Draft
          </Button>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Business Summary" subtitle="Ask about pending payments, low stock, labour balance, delayed sites, or profit." />
        <div className={styles.promptGrid}>
          <Badge tone="info">INR protected</Badge>
          <Badge tone="success">PDF and Excel ready</Badge>
        </div>
      </Card>

      <div className={styles.composer}>
        <textarea
          className={styles.input}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Example: Bought 50 cement bags at 360 each for Shivneri site from Ramesh supplier"
        />
        <Button onClick={() => ask()} disabled={busy}>
          {busy ? "Thinking..." : "Ask AI"}
        </Button>
      </div>

      <ToastMessage message={toast} duration={2400} onDismiss={() => setToast(null)} />
    </section>
  );
}
