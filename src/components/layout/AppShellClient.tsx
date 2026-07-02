"use client";

import {
  IonApp,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonPage,
  IonToolbar
} from "@ionic/react";
import { addOutline, moonOutline, searchOutline, sparklesOutline, sunnyOutline } from "ionicons/icons";
import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { appName } from "@/lib/env";
import { useAuth } from "@/lib/auth";
import { useUiStore } from "@/lib/ui-store";
import { appRoutes, mainTabs, quickActions } from "@/config/routes";
import { SyncStatusCard } from "@/features/sync/SyncStatusCard";
import styles from "./AppShell.module.css";

export function AppShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { company, loading, offlineMode } = useAuth();
  const mode = useUiStore((state) => state.mode);
  const toggleMode = useUiStore((state) => state.toggleMode);
  const quickOpen = useUiStore((state) => state.quickAddOpen);
  const setQuickOpen = useUiStore((state) => state.setQuickAddOpen);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!loading && !company) router.replace("/login");
  }, [company, loading, router]);

  const filteredRoutes = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return appRoutes;
    return appRoutes.filter((route) => `${route.label} ${route.description}`.toLowerCase().includes(term));
  }, [query]);

  const go = (path: string) => {
    setQuickOpen(false);
    setSearchOpen(false);
    router.push(path);
  };

  return (
    <IonApp>
      <IonPage>
        <IonHeader translucent>
          <IonToolbar>
            <div className={styles.topBar}>
              <div className={styles.titleBlock}>
                <p className={styles.eyebrow}>{company?.name || appName}</p>
                <h1 className={styles.title}>{title}</h1>
              </div>
              <div className={styles.headerActions}>
                <button className={styles.iconButton} type="button" aria-label="Search everything" onClick={() => setSearchOpen(true)}>
                  <IonIcon icon={searchOutline} />
                </button>
                <button className={styles.iconButton} type="button" aria-label="Toggle theme" onClick={toggleMode}>
                  <IonIcon icon={mode === "dark" ? sunnyOutline : moonOutline} />
                </button>
              </div>
            </div>
          </IonToolbar>
        </IonHeader>

        <IonContent fullscreen className={styles.page}>
          <main className={styles.content}>
            {subtitle ? <p className={styles.sheetSub}>{subtitle}</p> : null}
            {offlineMode ? <SyncStatusCard compact /> : null}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
              {children}
            </motion.div>
          </main>
        </IonContent>

        <button className={styles.aiButton} type="button" data-testid="ask-ai-button" onClick={() => router.push("/ai")}>
          <IonIcon icon={sparklesOutline} />
          <span>Ask AI</span>
        </button>

        <nav className={styles.bottomNav} aria-label="Main navigation">
          {mainTabs.map((route) => (
            <button
              key={route.path}
              className={`${styles.navButton} ${
                pathname === route.path || (route.path !== "/dashboard" && pathname.startsWith(route.path)) ? styles.navButtonActive : ""
              }`}
              type="button"
              onClick={() => router.push(route.path)}
            >
              <IonIcon icon={route.icon} />
              <span className={styles.navIconLabel}>{route.label}</span>
            </button>
          ))}
        </nav>

        <button className={styles.addButton} type="button" data-testid="quick-add-button" aria-label="Open quick add" onClick={() => setQuickOpen(true)}>
          <IonIcon icon={addOutline} />
          <span>Add</span>
        </button>

        <IonModal isOpen={quickOpen} onDidDismiss={() => setQuickOpen(false)} className="mobile-sheet" initialBreakpoint={1} breakpoints={[0, 1]}>
          <div className={styles.quickSheet}>
            <div className={styles.sheetHandle} />
            <h2 className={styles.sheetTitle}>Quick Add</h2>
            <p className={styles.sheetSub}>Fast daily entries with site ownership, validation, and offline queue support.</p>
            <div className={styles.quickGrid}>
              {quickActions.map((action) => (
                <button key={action.path} className={styles.quickCard} type="button" onClick={() => go(action.path)}>
                  <IonIcon icon={action.icon} />
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </IonModal>

        <IonModal isOpen={searchOpen} onDidDismiss={() => setSearchOpen(false)} className="mobile-sheet" initialBreakpoint={1} breakpoints={[0, 1]}>
          <div className={styles.searchSheet}>
            <div className={styles.sheetHandle} />
            <h2 className={styles.sheetTitle}>Search Everything</h2>
            <p className={styles.sheetSub}>Search modules like bills, labour wages, POP calculator, reports, payments, audit, memory, and settings.</p>
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search any feature"
              style={{
                width: "100%",
                minHeight: 54,
                borderRadius: 18,
                border: "1px solid var(--app-border)",
                padding: "0 14px",
                background: "var(--app-surface)",
                color: "var(--app-text)",
                marginBottom: 14
              }}
            />
            <div className={styles.searchList}>
              {filteredRoutes.map((route) => (
                <button key={`${route.path}-${route.label}`} className={styles.searchItem} type="button" onClick={() => go(route.path)}>
                  <IonIcon icon={route.icon} />
                  <span>
                    <strong>{route.label}</strong>
                    <p>{route.description}</p>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </IonModal>
      </IonPage>
    </IonApp>
  );
}
