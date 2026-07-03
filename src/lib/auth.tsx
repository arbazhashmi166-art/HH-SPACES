"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createId } from "./id";
import { hasSupabaseConfig } from "./env";
import { requireSupabase, supabase } from "./supabase";
import type { Company, Profile, Role } from "@/types/domain";

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  company: Company | null;
  role: Role;
  loading: boolean;
  offlineMode: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { email: string; password: string; companyName: string; fullName: string }) => Promise<void>;
  signOut: () => Promise<void>;
  continueOffline: () => void;
  refreshCompany: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const offlineCompany: Company = {
  id: "offline-company",
  owner_id: "offline-user",
  name: "Offline Company",
  gst_number: null,
  pan_number: null,
  address: null,
  phone: null,
  email: null,
  bank_details: null,
  upi_id: null,
  logo_url: null
};

const offlineRememberKey = "sitetracker.offlineMode";
const localUserKey = "sitetracker.localUser";

const allowedLocalUsers: Record<string, { password: string; fullName: string; role: Role }> = {
  SAHIL123: { password: "DAVID9529", fullName: "Sahil", role: "admin" },
  ARBAZ123: { password: "BUCKY1081", fullName: "Arbaz", role: "admin" }
};

function isOfflineRemembered() {
  return typeof window !== "undefined" && window.localStorage.getItem(offlineRememberKey) === "1";
}

function rememberOfflineMode(enabled: boolean) {
  if (typeof window === "undefined") return;
  if (enabled) {
    window.localStorage.setItem(offlineRememberKey, "1");
  } else {
    window.localStorage.removeItem(offlineRememberKey);
  }
}

function rememberLocalUser(username: string | null) {
  if (typeof window === "undefined") return;
  if (username) {
    window.localStorage.setItem(localUserKey, username);
  } else {
    window.localStorage.removeItem(localUserKey);
  }
}

function rememberedLocalUser() {
  if (typeof window === "undefined") return null;
  const username = window.localStorage.getItem(localUserKey);
  return username ? allowedLocalUsers[username] || null : null;
}

function recordMeta(userId: string | null) {
  const now = new Date().toISOString();
  return {
    created_by: userId,
    updated_by: userId,
    created_at: now,
    updated_at: now,
    source: "manual",
    sync_status: "synced",
    idempotency_key: createId("idem"),
    archived: false,
    deleted_at: null
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [role, setRole] = useState<Role>("viewer");
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  const loadCompany = useCallback(async (currentSession: Session | null) => {
    if (!currentSession || !supabase) return;
    const userId = currentSession.user.id;

    const { data: profileRow } = await requireSupabase().from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile((profileRow as Profile | null) || null);

    const { data: member } = await requireSupabase()
      .from("company_members")
      .select("role, companies(*)")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (member?.companies) {
      setCompany(member.companies as unknown as Company);
      setRole((member.role as Role) || "viewer");
      return;
    }

    const companyId = createId("company");
    const { data: companyData, error: companyError } = await requireSupabase()
      .from("companies")
      .insert({
        id: companyId,
        owner_id: userId,
        name: profileRow?.full_name ? `${profileRow.full_name}'s Company` : "My Construction Company"
      })
      .select("*")
      .single();

    if (companyError) throw companyError;

    await requireSupabase().from("company_members").insert({
      id: createId("member"),
      company_id: companyId,
      user_id: userId,
      full_name: profileRow?.full_name || currentSession.user.email || "Admin",
      email: currentSession.user.email || "",
      role: "admin",
      status: "active",
      phone: null,
      can_delete_financial: true,
      ...recordMeta(userId)
    });

    setCompany(companyData as Company);
    setRole("admin");
  }, []);

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      if (!hasSupabaseConfig() || !supabase) {
        setOfflineMode(true);
        setCompany(offlineCompany);
        setRole("admin");
        setLoading(false);
        return;
      }

      if (isOfflineRemembered()) {
        const localUser = rememberedLocalUser();
        setOfflineMode(true);
        setCompany({ ...offlineCompany, name: "H&H Spaces" });
        setProfile(localUser ? { id: "offline-user", full_name: localUser.fullName, phone: null, avatar_url: null } : null);
        setRole(localUser?.role || "admin");
        setLoading(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      if (data.session) await loadCompany(data.session);
      setLoading(false);
    };
    boot().catch(() => setLoading(false));

    const subscription = supabase?.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        rememberOfflineMode(false);
        setOfflineMode(false);
        loadCompany(nextSession).catch(() => undefined);
      } else {
        if (isOfflineRemembered()) {
          const localUser = rememberedLocalUser();
          setOfflineMode(true);
          setCompany({ ...offlineCompany, name: "H&H Spaces" });
          setProfile(localUser ? { id: "offline-user", full_name: localUser.fullName, phone: null, avatar_url: null } : null);
          setRole(localUser?.role || "admin");
          return;
        }
        setProfile(null);
        setCompany(null);
        setRole("viewer");
      }
    });

    return () => {
      mounted = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, [loadCompany]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user || null,
      profile,
      company: offlineMode ? company || { ...offlineCompany, name: "H&H Spaces" } : company,
      role,
      loading,
      offlineMode,
      signIn: async (email, password) => {
        const username = email.trim().toUpperCase();
        const localUser = allowedLocalUsers[username];
        if (localUser) {
          if (password !== localUser.password) throw new Error("Wrong password for this username.");
          rememberOfflineMode(true);
          rememberLocalUser(username);
          setSession(null);
          setOfflineMode(true);
          setProfile({ id: "offline-user", full_name: localUser.fullName, phone: null, avatar_url: null });
          setCompany({ ...offlineCompany, name: "H&H Spaces" });
          setRole(localUser.role);
          return;
        }

        if (!email.includes("@")) {
          throw new Error("Use ARBAZ123, SAHIL123, or a Supabase email address.");
        }

        const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
        if (error) throw error;
        rememberOfflineMode(false);
        rememberLocalUser(null);
        setOfflineMode(false);
      },
      signUp: async ({ email, password, companyName, fullName }) => {
        const { data, error } = await requireSupabase().auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName }
          }
        });
        if (error) throw error;
        rememberOfflineMode(false);
        rememberLocalUser(null);
        setOfflineMode(false);
        const userId = data.user?.id;
        if (!userId) return;

        await requireSupabase().from("profiles").upsert({
          id: userId,
          full_name: fullName,
          phone: null,
          avatar_url: null
        });

        const companyId = createId("company");
        await requireSupabase().from("companies").insert({
          id: companyId,
          owner_id: userId,
          name: companyName
        });
        await requireSupabase().from("company_members").insert({
          id: createId("member"),
          company_id: companyId,
          user_id: userId,
          full_name: fullName,
          email,
          role: "admin",
          status: "active",
          phone: null,
          can_delete_financial: true,
          ...recordMeta(userId)
        });
      },
      signOut: async () => {
        if (supabase) await supabase.auth.signOut();
        rememberOfflineMode(false);
        rememberLocalUser(null);
        setOfflineMode(false);
        setProfile(null);
        setCompany(null);
        setRole("viewer");
      },
      continueOffline: () => {
        rememberOfflineMode(true);
        rememberLocalUser(null);
        setOfflineMode(true);
        setCompany({ ...offlineCompany, name: "H&H Spaces" });
        setRole("admin");
      },
      refreshCompany: async () => loadCompany(session)
    }),
    [company, loadCompany, loading, offlineMode, profile, role, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
