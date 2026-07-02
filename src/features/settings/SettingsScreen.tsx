"use client";

import { IonIcon, IonToast } from "@ionic/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FieldShell, TextArea, TextInput } from "@/components/ui/form-controls";
import { appRoutes } from "@/config/routes";
import { useAuth } from "@/lib/auth";
import { useUiStore } from "@/lib/ui-store";
import { requireSupabase, supabase } from "@/lib/supabase";
import styles from "./Settings.module.css";

export function SettingsScreen() {
  const router = useRouter();
  const { company, role, signOut, refreshCompany } = useAuth();
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
          <div className={styles.setting}>
            <span>Labour</span>
            <strong>Default rates, OT, half-day rules</strong>
          </div>
          <div className={styles.setting}>
            <span>Billing</span>
            <strong>Invoice prefix, GST, TDS, terms</strong>
          </div>
          <div className={styles.setting}>
            <span>Material</span>
            <strong>Categories, units, low-stock alerts</strong>
          </div>
          <div className={styles.setting}>
            <span>Backup</span>
            <strong>Supabase sync, export, restore, daily backup</strong>
          </div>
          <div className={styles.setting}>
            <span>WhatsApp</span>
            <strong>Client, supplier, labour report sharing</strong>
          </div>
          <div className={styles.setting}>
            <span>Vehicles</span>
            <strong>Fuel, mileage, service, driver details</strong>
          </div>
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
            .filter((route, index, list) => list.findIndex((item) => item.path === route.path) === index)
            .map((route) => (
              <button key={route.path} className={styles.module} type="button" onClick={() => router.push(route.path)}>
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
