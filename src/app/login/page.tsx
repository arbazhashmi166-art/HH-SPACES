"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldShell, TextInput } from "@/components/ui/form-controls";
import { useAuth } from "@/lib/auth";
import { appName } from "@/lib/env";
import { loginSchema, signUpSchema } from "@/lib/schemas";
import styles from "./Login.module.css";

type LoginValues = z.infer<typeof loginSchema>;
type SignupValues = z.infer<typeof signUpSchema>;

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return fallback;
}

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp, continueOffline, company, loading, offlineMode } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const signupForm = useForm<SignupValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", password: "", fullName: "", companyName: "H&H Spaces" }
  });

  useEffect(() => {
    if (!loading && company) router.replace("/dashboard");
  }, [company, loading, router]);

  const onLogin = loginForm.handleSubmit(async (values) => {
    setError(null);
    try {
      await signIn(values.email, values.password);
      router.replace("/dashboard");
    } catch (err) {
      setError(errorMessage(err, "Login failed. Check your credentials."));
    }
  });

  const onSignup = signupForm.handleSubmit(async (values) => {
    setError(null);
    try {
      await signUp(values);
      router.replace("/dashboard");
    } catch (err) {
      setError(errorMessage(err, "Signup failed. Check Supabase settings."));
    }
  });

  const offline = () => {
    continueOffline();
    router.replace("/dashboard");
  };

  return (
    <main className={styles.screen}>
      <section className={styles.hero}>
        <div className={styles.brand}>
          <span className={styles.logo}>
            <Building2 size={22} />
          </span>
          <span>{appName}</span>
        </div>
        <h1 className={styles.headline}>Contractor OS for daily site control.</h1>
        <p className={styles.subtitle}>
          Secure company login, offline entries, Supabase sync, AI drafts, reports, audit logs, and clean iPhone-first screens.
        </p>

        <Card>
          <div className={styles.switchRow}>
            <button className={mode === "login" ? styles.active : ""} type="button" onClick={() => setMode("login")}>
              Login
            </button>
            <button className={mode === "signup" ? styles.active : ""} type="button" onClick={() => setMode("signup")}>
              Create Company
            </button>
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}

          {mode === "login" ? (
            <form className={styles.form} onSubmit={onLogin}>
              <FieldShell label="Username or Email" error={loginForm.formState.errors.email?.message}>
                <TextInput type="text" autoComplete="username" placeholder="Enter username or email" {...loginForm.register("email")} />
              </FieldShell>
              <FieldShell label="Password" error={loginForm.formState.errors.password?.message}>
                <TextInput type="password" autoComplete="current-password" {...loginForm.register("password")} />
              </FieldShell>
              <p className={styles.note}>Approved username login connects this device to Supabase cloud sync.</p>
              <Button full disabled={loginForm.formState.isSubmitting}>
                {loginForm.formState.isSubmitting ? "Signing in..." : "Login"}
              </Button>
              {offlineMode ? null : (
                <Button type="button" full variant="secondary" onClick={offline}>
                  Use This Device Only (No Cloud)
                </Button>
              )}
            </form>
          ) : (
            <form className={styles.form} onSubmit={onSignup}>
              <FieldShell label="Full Name" error={signupForm.formState.errors.fullName?.message}>
                <TextInput autoComplete="name" {...signupForm.register("fullName")} />
              </FieldShell>
              <FieldShell label="Company Name" error={signupForm.formState.errors.companyName?.message}>
                <TextInput {...signupForm.register("companyName")} />
              </FieldShell>
              <FieldShell label="Email" error={signupForm.formState.errors.email?.message}>
                <TextInput type="email" autoComplete="email" {...signupForm.register("email")} />
              </FieldShell>
              <FieldShell label="Password" error={signupForm.formState.errors.password?.message}>
                <TextInput type="password" autoComplete="new-password" {...signupForm.register("password")} />
              </FieldShell>
              <Button full disabled={signupForm.formState.isSubmitting}>
                {signupForm.formState.isSubmitting ? "Creating..." : "Create Company"}
              </Button>
            </form>
          )}
        </Card>
      </section>
    </main>
  );
}
