"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createId } from "./id";
import { hasSupabaseConfig } from "./env";
import { migrateLocalCompanyRecords, syncPendingMutations } from "./repository";
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
const cloudCompanyId = "hh-spaces-company";
const cloudCompanyName = "H&H Spaces";

const allowedLocalUsers: Record<string, { password: string; fullName: string; role: Role; cloudEmail: string }> = {
  SAHIL123: { password: "DAVID9529", fullName: "Sahil", role: "admin", cloudEmail: "sahil123@hhspaces.app" },
  ARBAZ123: { password: "BUCKY1081", fullName: "Arbaz", role: "admin", cloudEmail: "arbaz123@hhspaces.app" }
};

function approvedUserForEmail(email?: string | null) {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  return Object.values(allowedLocalUsers).find((user) => user.cloudEmail.toLowerCase() === normalized) || null;
}

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
    const approvedUser = approvedUserForEmail(currentSession.user.email);

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

    const companyId = approvedUser ? cloudCompanyId : createId("company");
    const companyName = approvedUser ? cloudCompanyName : profileRow?.full_name ? `${profileRow.full_name}'s Company` : "My Construction Company";
    let companyData: Company | null = null;

    const { data: existingCompany } = await requireSupabase().from("companies").select("*").eq("id", companyId).maybeSingle();
    if (existingCompany) {
      companyData = existingCompany as Company;
    } else {
      const { data: insertedCompany, error: companyError } = await requireSupabase()
        .from("companies")
        .insert({
          id: companyId,
          owner_id: userId,
          name: companyName
        })
        .select("*")
        .single();

      if (companyError && companyError.code !== "23505") throw companyError;
      companyData = (insertedCompany as Company | null) || null;
    }

    const { error: memberError } = await requireSupabase().from("company_members").insert({
      id: createId("member"),
      company_id: companyId,
      user_id: userId,
      full_name: approvedUser?.fullName || profileRow?.full_name || currentSession.user.email || "Admin",
      email: currentSession.user.email || "",
      role: approvedUser?.role || "admin",
      status: "active",
      phone: null,
      can_delete_financial: true,
      ...recordMeta(userId)
    });

    if (memberError && memberError.code !== "23505") {
      throw new Error(
        "Supabase company member policy is blocking cloud login. Run the latest supabase/schema.sql once in Supabase SQL Editor."
      );
    }

    if (!companyData) {
      const { data: selectedCompany, error: selectError } = await requireSupabase().from("companies").select("*").eq("id", companyId).single();
      if (selectError) throw selectError;
      companyData = selectedCompany as Company;
    }

    if (approvedUser) {
      await migrateLocalCompanyRecords("offline-company", companyId, userId);
      await syncPendingMutations(companyId);
    }

    setCompany(companyData);
    setRole(approvedUser?.role || "admin");
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

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        rememberOfflineMode(false);
        rememberLocalUser(null);
        setOfflineMode(false);
        await loadCompany(data.session);
      } else if (isOfflineRemembered()) {
        rememberOfflineMode(false);
        rememberLocalUser(null);
        setOfflineMode(false);
      }
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
          setCompany({ ...offlineCompany, name: cloudCompanyName });
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
      company: offlineMode ? company || { ...offlineCompany, name: cloudCompanyName } : company,
      role,
      loading,
      offlineMode,
      signIn: async (email, password) => {
        const username = email.trim().toUpperCase();
        const localUser = allowedLocalUsers[username];
        if (localUser) {
          if (password !== localUser.password) throw new Error("Wrong password for this username.");
          if (!supabase) {
            rememberOfflineMode(true);
            rememberLocalUser(username);
            setSession(null);
            setOfflineMode(true);
            setProfile({ id: "offline-user", full_name: localUser.fullName, phone: null, avatar_url: null });
            setCompany({ ...offlineCompany, name: cloudCompanyName });
            setRole(localUser.role);
            return;
          }

          const cloudEmail = localUser.cloudEmail;
          const login = await requireSupabase().auth.signInWithPassword({ email: cloudEmail, password });
          if (login.error) {
            const signup = await requireSupabase().auth.signUp({
              email: cloudEmail,
              password,
              options: { data: { full_name: localUser.fullName } }
            });
            if (signup.error) throw signup.error;
            if (!signup.data.session) {
              throw new Error("Cloud user created, but Supabase email confirmation is ON. Turn off email confirmation in Supabase Auth, then login again.");
            }
            rememberOfflineMode(false);
            rememberLocalUser(null);
            setOfflineMode(false);
            setSession(signup.data.session);
            await loadCompany(signup.data.session);
            return;
          }

          if (!login.data.session) throw new Error("Cloud login failed. Check Supabase Auth settings.");
          rememberOfflineMode(false);
          rememberLocalUser(null);
          setOfflineMode(false);
          setSession(login.data.session);
          await loadCompany(login.data.session);
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
        setCompany({ ...offlineCompany, name: cloudCompanyName });
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
