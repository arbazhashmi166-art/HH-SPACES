"use client";

import { IonIcon, IonToast } from "@ionic/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FieldShell, TextArea, TextInput } from "@/components/ui/form-controls";
import { appRoutes } from "@/config/routes";
import { SyncStatusCard } from "@/features/sync/SyncStatusCard";
import { useAuth } from "@/lib/auth";
import { useUiStore } from "@/lib/ui-store";
import { requireSupabase, supabase } from "@/lib/supabase";
import styles from "./Settings.module.css";

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

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const openRoute = (path: string) => {
    router.push(path);
    const hash = path.split("#")[1];
    if (hash) {
      window.setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    }
  };

  const openCloudLogin = async () => {
    await signOut();
    router.replace("/login");
  };

  useEffect(() => {
    if (window.location.hash !== "#supabase-sync") return;
    window.setTimeout(() => document.getElementById("supabase-sync")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }, []);

  const save = async () => {
    if (!company) return;
    if (supabase) {
      const { error } = await requireSupabase().from("companies").update(form).eq("id", company.id);
      if (error) {
        setToast(error.message);
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
                ? "This device is connected to Supabase. Use Retry Sync for pending local entries."
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
            <strong>{session && supabase && !offlineMode ? "Laptop and phone sync" : "Local only until login"}</strong>
          </div>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={openCloudLogin}>
            Login for Supabase Sync
          </Button>
          <Button variant="ghost" onClick={() => setToast("Supabase Sync is the card above. Pending entries sync automatically when online.")}>
            What This Means
          </Button>
        </div>
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
        <CardHeader title="Business Defaults" subtitle="Clean grouped settings for phone use instead of one long settings screen." />
        <div className={styles.grid}>
          <button className={styles.setting} type="button" onClick={() => router.push("/labour")}>
            <span>Labour</span>
            <strong>Default rates, OT, half-day rules</strong>
          </button>
          <button className={styles.setting} type="button" onClick={() => router.push("/payments")}>
            <span>Billing</span>
            <strong>Invoice prefix, GST, TDS, terms</strong>
          </button>
          <button className={styles.setting} type="button" onClick={() => router.push("/materials")}>
            <span>Material</span>
            <strong>Categories, units, low-stock alerts</strong>
          </button>
          <button className={styles.setting} type="button" onClick={() => document.getElementById("supabase-sync")?.scrollIntoView({ behavior: "smooth" })}>
            <span>Backup</span>
            <strong>Supabase sync, export, restore, daily backup</strong>
          </button>
          <button className={styles.setting} type="button" onClick={() => router.push("/reports")}>
            <span>WhatsApp</span>
            <strong>Client, supplier, labour report sharing</strong>
          </button>
          <button className={styles.setting} type="button" onClick={() => router.push("/expenses")}>
            <span>Vehicles</span>
            <strong>Fuel, mileage, service, driver details</strong>
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
        <CardHeader title="All Modules" subtitle="Open any module from one clean phone-friendly list." />
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

      <IonToast isOpen={Boolean(toast)} message={toast || ""} duration={2200} onDidDismiss={() => setToast(null)} />
    </section>
  );
}
