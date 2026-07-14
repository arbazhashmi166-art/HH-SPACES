"use client";

import {
  IonApp,
  IonContent,
  IonIcon,
  IonPage,
} from "@ionic/react";
import { addOutline, moonOutline, searchOutline, sparklesOutline, sunnyOutline } from "ionicons/icons";
import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { appName } from "@/lib/env";
import { useAuth } from "@/lib/auth";
import { useUiStore } from "@/lib/ui-store";
import { appRoutes, mainTabs, quickActionGroups } from "@/config/routes";
import { SyncStatusCard } from "@/features/sync/SyncStatusCard";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./AppShell.module.css";

export function AppShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { company, loading, offlineMode, session } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const mode = useUiStore((state) => state.mode);
  const toggleMode = useUiStore((state) => state.toggleMode);
  const [quickOpen, setQuickOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const showQuickAdd =
    !pathname.startsWith("/quick-entry") &&
    !pathname.startsWith("/settings") &&
    !pathname.startsWith("/ai") &&
    !pathname.startsWith("/payment-recovery") &&
    !pathname.startsWith("/daily-closing") &&
    !pathname.startsWith("/partner-ledger") &&
    !pathname.startsWith("/business-brain") &&
    !pathname.startsWith("/cash-flow") &&
    !pathname.startsWith("/approval-center") &&
    !pathname.startsWith("/bill-scanner");
  const showAiButton = !pathname.startsWith("/bill-scanner");

  useEffect(() => {
    setMounted(true);
    setOfflineReady(window.localStorage.getItem("sitetracker.offlineMode") === "1");
  }, []);

  useEffect(() => {
    if (!loading && !company && !offlineReady) router.replace("/login");
  }, [company, loading, offlineReady, router]);

  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    const routeResults = appRoutes.map((route) => ({
      id: `route-${route.path}-${route.label}`,
      label: route.label,
      description: route.description,
      path: route.path,
      icon: route.icon,
      keywords: `${route.label} ${route.description}`.toLowerCase(),
      rank: 2
    }));
    const cleanPath = (path: string) => path.split("?")[0]?.split("#")[0] || path;
    const iconFor = (path: string) => appRoutes.find((route) => cleanPath(route.path) === cleanPath(path))?.icon || searchOutline;
    const commands = [
      {
        label: "Quick Entry Hub",
        description: "Open the one-tap daily add screen for attendance, expense, material, payment, progress, and extra work.",
        path: "/quick-entry",
        keywords: "quick entry quick add fast add daily entry shortcut one tap attendance material expense payment progress extra work",
        rank: 0
      },
      {
        label: "Create Bill or Client Payment",
        description: "Record received amount, pending amount, payment mode, and site-wise client balance.",
        path: "/payments?add=1",
        keywords: "bill invoice quotation quote client payment receipt pending collection finance customer",
        rank: 0
      },
      {
        label: "Add Extra Work",
        description: "Capture variation work, change orders, amount increases, client approval, and billing status.",
        path: "/extra-works?add=1",
        keywords: "extra work variation change order increase amount additional work waterproofing pop electrical billing unbilled",
        rank: 0
      },
      {
        label: "Payment Recovery",
        description: "Open pending client payments, reminders, cashflow radar, and WhatsApp follow-up actions.",
        path: "/payment-recovery",
        keywords: "payment recovery collect money receivable reminder overdue pending whatsapp cashflow",
        rank: 0
      },
      {
        label: "Partner Money Taken",
        description: "Track Arbaz, Sahil, or partner withdrawals, profit sharing, emergency money, and owner draws.",
        path: "/partner-ledger",
        keywords: "partner draw ledger money taken company money arbaz sahil profit sharing emergency owner withdrawal advance cash ledger",
        rank: 0
      },
      {
        label: "Smart Daily Closing",
        description: "End the day with attendance, material, expenses, progress, payment follow-up, and a WhatsApp-ready report.",
        path: "/daily-closing",
        keywords: "daily closing day close checklist daily report site closing whatsapp report attendance material expense progress followup",
        rank: 0
      },
      {
        label: "AI Business Brain",
        description: "Open the smart control screen for cash, risk, approvals, partner money, and next best actions.",
        path: "/business-brain",
        keywords: "business brain ai control smart risk cash approval partner action decision intelligence",
        rank: 0
      },
      {
        label: "Cash Flow Forecast",
        description: "Forecast 7, 15, and 30 day cash pressure from pending client money, supplier dues, and daily burn.",
        path: "/cash-flow",
        keywords: "cash flow forecast money pressure pending supplier labour burn collection finance future",
        rank: 0
      },
      {
        label: "Approval Center",
        description: "Approve or reject partner draws, extra work, supplier dues, expenses, and risky decisions.",
        path: "/approval-center",
        keywords: "approval approve reject partner draw extra work supplier payment expense decision permission",
        rank: 0
      },
      {
        label: "Bill Scanner",
        description: "Scan supplier bill photos with OCR and save verified material or expense entries.",
        path: "/bill-scanner",
        keywords: "bill scanner scan ocr photo receipt supplier material expense invoice camera",
        rank: 0
      },
      {
        label: "Supabase Cloud Sync",
        description: "Check whether phone and laptop data is connected to Supabase and sync pending entries.",
        path: "/settings#supabase-sync",
        keywords: "supabase sync cloud online offline backup phone laptop database realtime",
        rank: 0
      },
      {
        label: "Daily Site Entry",
        description: "Start attendance, labour wages, materials, expenses, and progress updates for today.",
        path: "/attendance?add=1",
        keywords: "daily update labour wage wedges attendance present absent half day site entry",
        rank: 1
      }
    ].map((command) => ({
      ...command,
      id: `command-${command.path}-${command.label}`,
      icon: iconFor(command.path)
    }));
    const allResults = [...commands, ...routeResults];
    if (!term) return allResults.slice(0, 18);
    return allResults
      .filter((item) => `${item.label} ${item.description} ${item.keywords}`.toLowerCase().includes(term))
      .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
      .slice(0, 18);
  }, [query]);

  const scrollToHash = (path: string) => {
    const hash = path.split("#")[1];
    if (!hash) {
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 80);
      return;
    }
    window.setTimeout(() => {
      if (window.location.hash !== `#${hash}`) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${hash}`);
      }
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 160);
  };

  const go = (path: string) => {
    setQuickOpen(false);
    setSearchOpen(false);
    setQuery("");
    window.setTimeout(() => {
      router.push(path, { scroll: false });
      scrollToHash(path);
    }, 0);
  };

  useEffect(() => {
    setQuickOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  if (!mounted) {
    return (
      <main className={styles.shellLoading} aria-label="Loading H&H SPACES">
        <Skeleton style={{ height: 110 }} />
        <Skeleton style={{ height: 184 }} />
        <Skeleton style={{ height: 124 }} />
      </main>
    );
  }

  return (
    <IonApp>
      <IonPage>
        <header className={styles.appHeader}>
          <div className={styles.topBar}>
            <div className={styles.brandCluster}>
              <div className={styles.brandMark} aria-hidden="true">
                H&H
              </div>
              <div className={styles.titleBlock}>
                <p className={styles.eyebrow}>{company?.name || appName}</p>
                <h1 className={styles.title}>{title}</h1>
              </div>
            </div>
            <div className={styles.headerActions}>
                <button
                  className={styles.iconButton}
                  type="button"
                  aria-label="Search everything"
                  onClick={() => {
                    setQuery("");
                    setSearchOpen(true);
                  }}
                >
                <IonIcon icon={searchOutline} />
              </button>
              <button className={styles.iconButton} type="button" aria-label="Toggle theme" onClick={toggleMode}>
                <IonIcon icon={mode === "dark" ? sunnyOutline : moonOutline} />
              </button>
            </div>
          </div>
          <div className={styles.statusDock} aria-label="Business command shortcuts">
            <button type="button" onClick={() => go("/daily-closing")}>
              <span>Today</span>
            </button>
            <button type="button" onClick={() => go("/quick-entry")}>
              <span>Add Entry</span>
            </button>
            <button type="button" onClick={() => go("/settings#supabase-sync")}>
              <span>{session && !offlineMode ? "Cloud Sync" : "Local Save"}</span>
            </button>
          </div>
        </header>

        <IonContent className={styles.page}>
          <main className={styles.content}>
            {subtitle ? <p className={styles.sheetSub}>{subtitle}</p> : null}
            {offlineMode && !pathname.startsWith("/settings") ? <SyncStatusCard compact /> : null}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
              {children}
            </motion.div>
          </main>
        </IonContent>

        {showAiButton ? (
          <button className={styles.aiButton} type="button" data-testid="ask-ai-button" onClick={() => router.push("/ai")}>
            <IonIcon icon={sparklesOutline} />
            <span>Ask AI</span>
          </button>
        ) : null}

        <nav className={styles.bottomNav} aria-label="Main navigation">
          {mainTabs.map((route) => (
            <button
              key={route.path}
              className={`${styles.navButton} ${
                pathname === route.path || (route.path !== "/dashboard" && pathname.startsWith(route.path)) ? styles.navButtonActive : ""
              }`}
              type="button"
              onClick={() => go(route.path)}
            >
              <IonIcon icon={route.icon} />
              <span className={styles.navIconLabel}>{route.label}</span>
            </button>
          ))}
        </nav>

        {showQuickAdd ? (
          <button className={styles.addButton} type="button" data-testid="quick-add-button" aria-label="Open quick add" onClick={() => setQuickOpen(true)}>
            <IonIcon icon={addOutline} />
            <span>Add</span>
          </button>
        ) : null}

        {quickOpen ? (
          <div className={styles.sheetOverlay} role="dialog" aria-modal="true" aria-label="Quick Add">
            <button className={styles.sheetBackdrop} type="button" aria-label="Close quick add" onClick={() => setQuickOpen(false)} />
            <div className={styles.quickSheet}>
            <div className={styles.sheetHandle} />
            <h2 className={styles.sheetTitle}>Quick Add</h2>
            <p className={styles.sheetSub}>Add today&apos;s site work without opening five different screens.</p>
            {quickActionGroups.map((group) => (
              <section className={styles.quickSection} key={group.title}>
                <h3>{group.title}</h3>
                <div className={styles.quickGrid}>
                  {group.actions.map((action) => (
                    <button key={action.path} className={styles.quickCard} type="button" onClick={() => go(action.path)}>
                      <IonIcon icon={action.icon} />
                      <span>
                        <strong>{action.label}</strong>
                        <small>{action.helper}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
            <button className={styles.sheetClose} type="button" onClick={() => setQuickOpen(false)}>
              Close
            </button>
          </div>
          </div>
        ) : null}

        {searchOpen ? (
          <div className={styles.sheetOverlay} role="dialog" aria-modal="true" aria-label="Search Everything">
            <button className={styles.sheetBackdrop} type="button" aria-label="Close search" onClick={() => setSearchOpen(false)} />
            <div className={styles.searchSheet}>
            <div className={styles.sheetHandle} />
            <h2 className={styles.sheetTitle}>Search Everything</h2>
            <p className={styles.sheetSub}>Search daily actions, money records, reports, bill scanner, Supabase sync, and advanced tools.</p>
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
              {searchResults.map((route) => (
                <button key={route.id} className={styles.searchItem} type="button" onClick={() => go(route.path)}>
                  <IonIcon icon={route.icon} />
                  <span>
                    <strong>{route.label}</strong>
                    <p>{route.description}</p>
                  </span>
                </button>
              ))}
            </div>
          </div>
          </div>
        ) : null}
      </IonPage>
    </IonApp>
  );
}
