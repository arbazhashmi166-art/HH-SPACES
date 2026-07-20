"use client";

import { IonIcon } from "@ionic/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FieldShell, TextArea, TextInput } from "@/components/ui/form-controls";
import { ToastMessage } from "@/components/ui/toast-message";
import { appRoutes } from "@/config/routes";
import { SyncStatusCard } from "@/features/sync/SyncStatusCard";
import { useAuth } from "@/lib/auth";
import { useUiStore } from "@/lib/ui-store";
import { requireSupabase, supabase } from "@/lib/supabase";
import { friendlyCloudWriteMessage } from "@/utils/cloud-error-message";
import styles from "./Settings.module.css";

const localCompanySettingsKey = "sitetracker.offlineCompanySettings";

export function SettingsScreen() {
  const router = useRouter();
  const { company, role, signOut, refreshCompany, offlineMode, session } = useAuth();
  const mode = useUiStore((state) => state.mode);
  const toggleMode = useUiStore((state) => state.toggleMode);
  const [form, setForm] = useState({
    name: company?.name || "",
    gst_number: company?.gst_number || "",
    pan_number: company?.pan_number || "",
    phone: company?.phone || "",
    email: company?.email || "",
    upi_id: company?.upi_id || "",
    address: company?.address || "",
    bank_details: company?.bank_details || ""
  });
  const [toast, setToast] = useState<string | null>(null);
  const [showSyncHelp, setShowSyncHelp] = useState(false);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const openRoute = (path: string) => {
    const hash = path.split("#")[1];
    router.push(path, { scroll: false });
    if (hash) {
      window.setTimeout(() => {
        if (window.location.hash !== `#${hash}`) {
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${hash}`);
        }
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 160);
    } else {
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 80);
    }
  };

  const openCloudLogin = async () => {
    await signOut();
    router.replace("/login");
  };

  useEffect(() => {
    if (!company) return;
    setForm({
      name: company.name || "",
      gst_number: company.gst_number || "",
      pan_number: company.pan_number || "",
      phone: company.phone || "",
      email: company.email || "",
      upi_id: company.upi_id || "",
      address: company.address || "",
      bank_details: company.bank_details || ""
    });
  }, [company]);

  useEffect(() => {
    if (window.location.hash !== "#supabase-sync") return;
    window.setTimeout(() => document.getElementById("supabase-sync")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }, []);

  const save = async () => {
    if (!company) return;
    if (!supabase || !session || offlineMode) {
      window.localStorage.setItem(localCompanySettingsKey, JSON.stringify(form));
      await refreshCompany();
      setToast("Settings saved on this device");
      return;
    }
    if (supabase) {
      const { error } = await requireSupabase().from("companies").update(form).eq("id", company.id);
      if (error) {
        setToast(friendlyCloudWriteMessage(error));
        return;
      }
      await refreshCompany();
    }
    setToast("Settings saved");
  };

  return (
    <section className={styles.stack}>
      <SyncStatusCard />

      <Card id="supabase-sync">
        <CardHeader
          title="Where Is Supabase Sync?"
          subtitle={
            supabase
              ? session
                ? "Supabase cloud sync is active. Entries save on this phone first, then upload to Supabase for laptop and iPhone sharing."
                : "Supabase is configured, but this device is not logged in. Login to sync laptop and phone data."
              : "This GitHub Pages build does not have Supabase keys. Add GitHub Actions secrets to enable cloud sync."
          }
        />
        <div className={styles.syncPanel}>
          <div>
            <span>Cloud Status</span>
            <strong>{supabase ? (session ? "Connected" : "Login needed") : "Not configured"}</strong>
          </div>
          <div>
            <span>Device Mode</span>
            <strong>{offlineMode ? "Offline device" : "Cloud device"}</strong>
          </div>
          <div>
            <span>Data Sharing</span>
            <strong>{session && supabase && !offlineMode ? "Cloud sync active" : "Local only until login"}</strong>
          </div>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={openCloudLogin}>
            Login for Supabase Sync
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setShowSyncHelp((current) => !current);
              setToast("Sync help opened");
            }}
          >
            What This Means
          </Button>
        </div>
        {showSyncHelp ? (
          <div className={styles.helpBox}>
            <strong>How sync works</strong>
            <p>Every entry saves on this phone first as a safety backup. If Supabase login is connected and internet is available, the app uploads those entries to Supabase automatically.</p>
            <p>If the card says Uploading to cloud, your entries are safe on this phone and waiting for upload. If it says Cloud synced, phone and laptop should see the same data.</p>
            <p>If this card says Local only, use Login for Supabase Sync and make sure the Supabase SQL schema is installed.</p>
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader title="Company Settings" subtitle="These details auto-fill PDFs, invoices, reports, WhatsApp messages, and headers." />
        <div className={styles.form}>
          <FieldShell label="Company Name">
            <TextInput value={form.name} onChange={(event) => update("name", event.target.value)} />
          </FieldShell>
          <div className={styles.grid}>
            <FieldShell label="GST Number">
              <TextInput value={form.gst_number} onChange={(event) => update("gst_number", event.target.value)} />
            </FieldShell>
            <FieldShell label="PAN Number">
              <TextInput value={form.pan_number} onChange={(event) => update("pan_number", event.target.value)} />
            </FieldShell>
          </div>
          <div className={styles.grid}>
            <FieldShell label="Phone">
              <TextInput value={form.phone} onChange={(event) => update("phone", event.target.value)} />
            </FieldShell>
            <FieldShell label="Email">
              <TextInput type="email" value={form.email} onChange={(event) => update("email", event.target.value)} />
            </FieldShell>
          </div>
          <FieldShell label="UPI ID">
            <TextInput value={form.upi_id} onChange={(event) => update("upi_id", event.target.value)} />
          </FieldShell>
          <FieldShell label="Address">
            <TextArea value={form.address} onChange={(event) => update("address", event.target.value)} />
          </FieldShell>
          <FieldShell label="Bank Details">
            <TextArea value={form.bank_details} onChange={(event) => update("bank_details", event.target.value)} />
          </FieldShell>
          <Button onClick={save}>Save Company Details</Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Daily Shortcuts" subtitle="The most useful working modules stay first. Advanced tools are kept lower in More." />
        <div className={styles.grid}>
          <button className={styles.setting} type="button" aria-label="Open Quick Entry" onClick={() => router.push("/quick-entry")}>
            <span>Quick Entry</span>
            <strong>One-tap daily add screen for site work and money</strong>
          </button>
          <button className={styles.setting} type="button" aria-label="Open Labour settings and workers" onClick={() => router.push("/labour")}>
            <span>Labour</span>
            <strong>Rates, workers, advances, balances</strong>
          </button>
          <button className={styles.setting} type="button" aria-label="Open Client Payments" onClick={() => router.push("/payments")}>
            <span>Client Payments</span>
            <strong>Received, pending, payment history</strong>
          </button>
          <button className={styles.setting} type="button" aria-label="Open Bill Scanner" onClick={() => router.push("/bill-scanner")}>
            <span>Bill Scanner</span>
            <strong>OCR supplier bills into material or expense entries</strong>
          </button>
          <button className={styles.setting} type="button" aria-label="Open Materials" onClick={() => router.push("/materials")}>
            <span>Materials</span>
            <strong>Purchases, suppliers, bills, stock history</strong>
          </button>
          <button
            className={styles.setting}
            type="button"
            aria-label="Open Cloud Sync status"
            onClick={() => document.getElementById("supabase-sync")?.scrollIntoView({ behavior: "smooth" })}
          >
            <span>Cloud Sync</span>
            <strong>Supabase status and retry sync</strong>
          </button>
          <button className={styles.setting} type="button" aria-label="Open Reports" onClick={() => router.push("/reports")}>
            <span>Reports</span>
            <strong>PDF, Excel, CSV exports</strong>
          </button>
          <button className={styles.setting} type="button" aria-label="Open Daily Closing" onClick={() => router.push("/daily-closing")}>
            <span>Daily Closing</span>
            <strong>End-day checklist and report</strong>
          </button>
          <button className={styles.setting} type="button" aria-label="Open Partner Ledger" onClick={() => router.push("/partner-ledger")}>
            <span>Partner Ledger</span>
            <strong>Company money taken by each partner</strong>
          </button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Theme and Access" subtitle={`Current role: ${role}. Theme: ${mode}.`} />
        <div className={styles.grid}>
          <Button variant="secondary" onClick={toggleMode}>
            Toggle Dark Mode
          </Button>
          <Button variant="danger" onClick={() => signOut().then(() => router.replace("/login"))}>
            Logout
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="All Modules and Advanced Tools" subtitle="Daily screens, reports, AI, audit, health, and admin tools are grouped here when needed." />
        <div className={styles.moduleGrid}>
          {appRoutes
            .filter((route) => route.group !== "main")
            .filter((route, index, list) => list.findIndex((item) => item.path === route.path) === index)
            .map((route) => (
              <button key={route.path} className={styles.module} type="button" onClick={() => openRoute(route.path)}>
                <IonIcon icon={route.icon} />
                <span>
                  <strong>{route.label}</strong>
                  <p>{route.description}</p>
                </span>
              </button>
            ))}
        </div>
      </Card>

      <ToastMessage message={toast} duration={2200} onDismiss={() => setToast(null)} />
    </section>
  );
}
