"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldShell, TextInput } from "@/components/ui/form-controls";
import { useAuth } from "@/lib/auth";
import { appName, basePath } from "@/lib/env";
import { loginSchema, signUpSchema } from "@/lib/schemas";
import styles from "./Login.module.css";

type LoginValues = z.infer<typeof loginSchema>;
type SignupValues = z.infer<typeof signUpSchema>;

const rememberLoginKey = "hhspaces.rememberedLogin";

const resetSchema = z.object({
  email: z.string().trim().email("Enter your account email")
});

const joinSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name"),
  contact: z.string().trim().min(5, "Enter your mobile number or email"),
  inviteCode: z.string().trim().min(4, "Enter the invitation code")
});

type ResetValues = z.infer<typeof resetSchema>;
type JoinValues = z.infer<typeof joinSchema>;

function friendlyAuthMessage(error: unknown, fallback: string) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message)
        : fallback;
  const lower = message.toLowerCase();

  if (
    lower.includes("invalid login") ||
    lower.includes("wrong password") ||
    lower.includes("incorrect username") ||
    lower.includes("incorrect password")
  ) {
    return "Incorrect username or password.";
  }
  if (lower.includes("fetch") || lower.includes("network") || lower.includes("failed to") || lower.includes("timeout")) {
    return "Cloud service is not reachable right now. Check internet, retry, or continue offline for emergency work.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (lower.includes("confirm") || lower.includes("email not confirmed")) {
    return "This account is waiting for email confirmation or admin approval.";
  }
  if (lower.includes("could not find the table") || lower.includes("database tables are missing") || lower.includes("schema.sql")) {
    return "Cloud login is available, but the cloud database needs setup. Continue offline now, then run the Supabase SQL setup.";
  }
  if (lower.includes("authapierror") || lower.includes("postgresterror") || lower.includes("jwt")) {
    return fallback;
  }

  return message || fallback;
}

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp, resetPassword, continueOffline, company, loading, offlineMode } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "join">("login");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [offlineWarningOpen, setOfflineWarningOpen] = useState(false);
  const [offlineContinuing, setOfflineContinuing] = useState(false);
  const [ready, setReady] = useState(false);

  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const signupForm = useForm<SignupValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", password: "", fullName: "", companyName: "H&H Spaces" }
  });
  const resetForm = useForm<ResetValues>({ resolver: zodResolver(resetSchema), defaultValues: { email: "" } });
  const joinForm = useForm<JoinValues>({ resolver: zodResolver(joinSchema), defaultValues: { fullName: "", contact: "", inviteCode: "" } });

  useEffect(() => {
    if (!loading && company) router.replace("/dashboard");
  }, [company, loading, router]);

  useEffect(() => {
    setReady(true);
    const remembered = typeof window === "undefined" ? null : window.localStorage.getItem(rememberLoginKey);
    if (remembered) loginForm.setValue("email", remembered);
  }, [loginForm]);

  const clearFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  const onLogin = loginForm.handleSubmit(async (values) => {
    clearFeedback();
    try {
      await signIn(values.email, values.password);
      if (typeof window !== "undefined") {
        if (rememberDevice) {
          window.localStorage.setItem(rememberLoginKey, values.email.trim());
        } else {
          window.localStorage.removeItem(rememberLoginKey);
        }
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(friendlyAuthMessage(err, "Login failed. Check your credentials."));
    }
  });

  const onSignup = signupForm.handleSubmit(async (values) => {
    clearFeedback();
    try {
      await signUp(values);
      router.replace("/dashboard");
    } catch (err) {
      setError(friendlyAuthMessage(err, "Create company failed. Check internet and try again."));
    }
  });

  const onReset = resetForm.handleSubmit(async (values) => {
    clearFeedback();
    try {
      await resetPassword(values.email);
      setSuccess("If this email has an account, a password reset link will be sent.");
      setResetOpen(false);
      resetForm.reset();
    } catch (err) {
      setError(friendlyAuthMessage(err, "Could not send reset link. Check internet and try again."));
    }
  });

  const onJoinRequest = joinForm.handleSubmit(async (values) => {
    clearFeedback();
    const message = [
      "H&H SPACES join request",
      `Name: ${values.fullName}`,
      `Contact: ${values.contact}`,
      `Invitation code: ${values.inviteCode}`,
      "Please add this user in Staff Management and share login details."
    ].join("\n");
    try {
      await navigator.clipboard.writeText(message);
      setSuccess("Join request copied. Send it to the owner or admin for approval in Staff Management.");
    } catch {
      setSuccess(message);
    }
    joinForm.reset();
  });

  const offline = () => {
    if (offlineContinuing) return;
    setOfflineContinuing(true);
    const nextCompany = continueOffline();
    if (!nextCompany.id) {
      setOfflineContinuing(false);
      return;
    }
    router.replace("/dashboard");
    window.setTimeout(() => {
      if (window.location.pathname.endsWith("/login") || window.location.pathname.endsWith("/login/")) {
        window.location.assign(`${basePath}/dashboard/`);
      }
    }, 250);
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
        <h1 className={styles.headline}>Run every construction site from one place.</h1>
        <p className={styles.subtitle}>
          Track labour, material, expenses, progress, bills and site reports, even when the internet is unavailable.
        </p>
        <div className={styles.benefits} aria-label="App benefits">
          <span>Daily control</span>
          <span>Cloud backup</span>
          <span>Offline work</span>
        </div>

        <Card>
          <div className={styles.formHeader}>
            <div>
              <p className={styles.kicker}>Welcome back</p>
              <h2>Manage your company securely.</h2>
            </div>
            <span className={styles.trustBadge}>
              <ShieldCheck size={16} />
              Cloud ready
            </span>
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}
          {success ? <p className={styles.success}>{success}</p> : null}

          {!ready ? (
            <div className={styles.form} aria-label="Preparing secure login">
              <p className={styles.note}>Preparing secure login on this device...</p>
              <Button type="button" full disabled>
                Loading...
              </Button>
              <Button type="button" full variant="secondary" disabled>
                Offline Opens After Loading
              </Button>
            </div>
          ) : mode === "login" ? (
            <form className={styles.form} onSubmit={onLogin}>
              <FieldShell label="Username or Email" error={loginForm.formState.errors.email?.message}>
                <TextInput
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  inputMode="email"
                  placeholder="Enter username or email"
                  {...loginForm.register("email")}
                />
              </FieldShell>
              <FieldShell label="Password" error={loginForm.formState.errors.password?.message}>
                <div className={styles.passwordWrap}>
                  <TextInput
                    className={styles.passwordInput}
                    type={showLoginPassword ? "text" : "password"}
                    autoComplete="current-password"
                    autoCapitalize="none"
                    spellCheck={false}
                    {...loginForm.register("password")}
                  />
                  <button
                    aria-label={showLoginPassword ? "Hide password" : "Show password"}
                    className={styles.passwordButton}
                    type="button"
                    onClick={() => setShowLoginPassword((value) => !value)}
                  >
                    {showLoginPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </FieldShell>

              <div className={styles.loginTools}>
                <label className={styles.checkboxLine}>
                  <input checked={rememberDevice} type="checkbox" onChange={(event) => setRememberDevice(event.target.checked)} />
                  <span>Remember this device</span>
                </label>
                <button className={styles.linkButton} type="button" onClick={() => setResetOpen((value) => !value)}>
                  Forgot password?
                </button>
              </div>

              {resetOpen ? (
                <div className={styles.resetBox}>
                  <FieldShell label="Account Email" error={resetForm.formState.errors.email?.message} helper="Password reset needs your real email address.">
                    <TextInput
                      type="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      inputMode="email"
                      placeholder="name@example.com"
                      {...resetForm.register("email")}
                    />
                  </FieldShell>
                  <Button type="button" full variant="secondary" disabled={resetForm.formState.isSubmitting} onClick={onReset}>
                    {resetForm.formState.isSubmitting ? "Sending..." : "Send Reset Link"}
                  </Button>
                </div>
              ) : null}

              <p className={styles.note}>Sign in to use cloud backup and share the same records across phone and laptop.</p>
              <Button type="submit" full disabled={loginForm.formState.isSubmitting}>
                {loginForm.formState.isSubmitting ? "Signing in..." : "Sign In"}
              </Button>
              {offlineMode ? null : (
                <Button type="button" full variant="secondary" onClick={() => setOfflineWarningOpen(true)}>
                  Continue Offline
                </Button>
              )}
            </form>
          ) : mode === "signup" ? (
            <form className={styles.form} onSubmit={onSignup}>
              <FieldShell label="Full Name" error={signupForm.formState.errors.fullName?.message}>
                <TextInput autoComplete="name" {...signupForm.register("fullName")} />
              </FieldShell>
              <FieldShell label="Company Name" error={signupForm.formState.errors.companyName?.message}>
                <TextInput autoComplete="organization" {...signupForm.register("companyName")} />
              </FieldShell>
              <FieldShell label="Email" error={signupForm.formState.errors.email?.message}>
                <TextInput
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  inputMode="email"
                  {...signupForm.register("email")}
                />
              </FieldShell>
              <FieldShell label="Password" error={signupForm.formState.errors.password?.message}>
                <div className={styles.passwordWrap}>
                  <TextInput
                    className={styles.passwordInput}
                    type={showSignupPassword ? "text" : "password"}
                    autoComplete="new-password"
                    autoCapitalize="none"
                    spellCheck={false}
                    {...signupForm.register("password")}
                  />
                  <button
                    aria-label={showSignupPassword ? "Hide new password" : "Show new password"}
                    className={styles.passwordButton}
                    type="button"
                    onClick={() => setShowSignupPassword((value) => !value)}
                  >
                    {showSignupPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </FieldShell>
              <p className={styles.note}>Create a new company only if you are the owner. Staff should join the existing company.</p>
              <Button type="submit" full disabled={signupForm.formState.isSubmitting}>
                {signupForm.formState.isSubmitting ? "Creating..." : "Create Workspace"}
              </Button>
            </form>
          ) : (
            <form className={styles.form} onSubmit={onJoinRequest}>
              <FieldShell label="Your Name" error={joinForm.formState.errors.fullName?.message}>
                <TextInput autoComplete="name" {...joinForm.register("fullName")} />
              </FieldShell>
              <FieldShell label="Mobile or Email" error={joinForm.formState.errors.contact?.message}>
                <TextInput autoComplete="email" autoCapitalize="none" spellCheck={false} {...joinForm.register("contact")} />
              </FieldShell>
              <FieldShell label="Invitation Code" error={joinForm.formState.errors.inviteCode?.message}>
                <TextInput autoCapitalize="characters" spellCheck={false} {...joinForm.register("inviteCode")} />
              </FieldShell>
              <p className={styles.note}>This creates a request message. The owner still approves access from Staff Management.</p>
              <Button type="submit" full>
                Copy Join Request
              </Button>
            </form>
          )}

          <div className={styles.secondaryLinks}>
            <button className={mode === "login" ? styles.activeLink : ""} type="button" onClick={() => setMode("login")}>
              Existing user? Sign in
            </button>
            <button className={mode === "signup" ? styles.activeLink : ""} type="button" onClick={() => setMode("signup")}>
              New owner? Create workspace
            </button>
            <button className={mode === "join" ? styles.activeLink : ""} type="button" onClick={() => setMode("join")}>
              Employee? Join company
            </button>
          </div>
        </Card>
      </section>

      {offlineWarningOpen ? (
        <div className={styles.modalBackdrop} role="presentation">
          <section aria-labelledby="offline-title" aria-modal="true" className={styles.modal} role="dialog">
            <h2 id="offline-title">Continue offline?</h2>
            <p>
              Data will remain only on this device and will not be backed up. Your data may be lost if you clear browser data, uninstall the app,
              change your phone, or clear Safari or Chrome storage.
            </p>
            <p className={styles.note}>You can connect this device data to cloud later from Settings, Cloud Sync.</p>
            <div className={styles.modalActions}>
              <Button type="button" full variant="secondary" onClick={() => setOfflineWarningOpen(false)}>
                Stay on Sign In
              </Button>
              <Button type="button" full variant="danger" disabled={offlineContinuing} onClick={offline}>
                {offlineContinuing ? "Opening Offline App..." : "I Understand, Continue Offline"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
