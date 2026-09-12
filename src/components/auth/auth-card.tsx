"use client";

import * as React from "react";
import {
  Bot,
  CheckCircle2,
  Cpu,
  Loader2,
  Lock,
  LogOut,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const GOOGLE_PATH = "/api/auth/signin/google";

export type AuthSession = {
  user?: { name: string | null; email: string | null; image: string | null };
  sub?: string;
  expires?: string;
};

async function getCsrfToken(): Promise<string> {
  const res = await fetch("/api/auth/csrf", { credentials: "include" });
  const data = (await res.json()) as { csrfToken: string };
  return data.csrfToken;
}

async function getSession(): Promise<AuthSession | null> {
  try {
    const res = await fetch("/api/auth/session", { credentials: "include" });
    const data = (await res.json()) as AuthSession;
    return data && data.user ? data : null;
  } catch {
    return null;
  }
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.96 10.96 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

export function AuthCard({ className }: { className?: string }) {
  const [csrfToken, setCsrfToken] = React.useState<string | null>(null);
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [signInError, setSignInError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [csrf, sess] = await Promise.all([getCsrfToken(), getSession()]);
        if (!mounted) return;
        setCsrfToken(csrf);
        setSession(sess);
        setStatus("ready");
      } catch {
        if (mounted) setStatus("error");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const signInWithGoogle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!csrfToken) return;
    const form = e.currentTarget as HTMLFormElement;
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "csrfToken";
    input.value = csrfToken;
    form.appendChild(input);
    form.submit();
  };

  const signOut = async () => {
    await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
    setSession(null);
    setCsrfToken(await getCsrfToken());
    setSignInError(null);
  };

  if (session?.user) {
    return (
      <Card className={cn("w-full max-w-sm border-silver/50 shadow-2xl", className)}>
        <CardHeader className="items-center text-center">
          <div className="mb-2 grid size-14 place-items-center rounded-2xl bg-rust text-porcelain shadow-lg">
            <Bot className="size-7 text-ember" />
          </div>
          <CardTitle className="text-porcelain">Signed in as operator</CardTitle>
          <CardDescription className="text-porcelain/60">
            Your identity is verified. The fleet awaits.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <a href="/" className="flex items-center gap-3 rounded-xl border border-silver/50 bg-obsidian/60 p-3 transition-colors hover:border-ember">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt=""
                className="size-10 rounded-full border border-silver/50"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="grid size-10 place-items-center rounded-full bg-ember text-lg font-black text-obsidian">
                {(session.user.name ?? "O")[0]}
              </span>
            )}
            <div className="text-left">
              <div className="text-sm font-bold text-porcelain">{session.user.name ?? "Operator"}</div>
              <div className="text-xs text-porcelain/60">{session.user.email ?? session.sub}</div>
            </div>
            <CheckCircle2 className="size-4 text-green-500" />
          </a>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button asChild className="w-full" variant="ember">
            <a href="/">Enter the console</a>
          </Button>
          <Button variant="outline" className="w-full border-silver/40 text-porcelain hover:bg-obsidian hover:text-ember" onClick={signOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full max-w-sm border-silver/50 shadow-2xl", className)}>
      <CardHeader className="items-center text-center">
        <span className="mb-2 grid size-14 place-items-center rounded-2xl bg-rust text-porcelain shadow-lg">
          {"{"}
          <Cpu className="ml-0.5 size-6 text-ember" />
        </span>
        <div className="font-mono text-[10px] uppercase tracking-widest text-ember">
          Sign in · Google OAuthentication
        </div>
        <CardTitle className="text-porcelain">Enter the machine economy</CardTitle>
        <CardDescription className="text-porcelain/60">
          Authenticate to access your fleet console, MCP bridge, and settlement
          ledger.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <form onSubmit={signInWithGoogle} action={GOOGLE_PATH} method="post" className="flex flex-col gap-2">
          <input type="hidden" name="callbackUrl" value="/" />
          <Button type="submit" variant="outline" size="xl" disabled={status !== "ready"} className="w-full border-silver/50 bg-obsidian/50 text-porcelain hover:border-ember hover:bg-obsidian hover:text-ember">
            {status === "loading" ? (
              <Loader2 className="size-4 animate-spin text-ember" />
            ) : (
              <GoogleIcon className="size-4" />
            )}
            Continue with Google
          </Button>
          {signInError && (
            <p className="text-center font-mono text-xs text-beacon">{signInError}</p>
          )}
          {status === "error" && (
            <p className="text-center font-mono text-xs text-beacon">
              auth service unreachable — is /api/auth deployed?
            </p>
          )}
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-silver/40" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card px-3 font-mono text-[10px] uppercase tracking-widest text-porcelain/50">
              or with email
            </span>
          </div>
        </div>

        <FieldGroup>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSignInError("Email + password sign-up is rolling out next. Use Google for now.");
            }}
          >
            <Field>
              <FieldLabel htmlFor="auth-email" className="text-porcelain/80">
                <Mail className="mb-0.5 mr-1 inline size-3.5 text-ember" />
                Email
              </FieldLabel>
              <Input
                id="auth-email"
                type="email"
                placeholder="you@example.com"
                required
                className="border-silver/40 bg-obsidian/50 text-porcelain placeholder:text-porcelain/30"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="auth-password" className="text-porcelain/80">
                <Lock className="mb-0.5 mr-1 inline size-3.5 text-ember" />
                Password
              </FieldLabel>
              <Input
                id="auth-password"
                type="password"
                placeholder="••••••••"
                className="border-silver/40 bg-obsidian/50 text-porcelain placeholder:text-porcelain/30"
              />
              <FieldDescription className="text-porcelain/40">
                Must be at least 8 characters.
              </FieldDescription>
            </Field>
            <Button type="submit" disabled className="w-full font-mono">
              <ShieldCheck className="size-4" /> Sign up — coming soon
            </Button>
          </form>
        </FieldGroup>
      </CardContent>

      <CardFooter className="justify-center border-t border-silver/40 pt-4">
        <p className="font-mono text-[11px] text-porcelain/40">
          by signing in you agree to the automated services agreement
        </p>
      </CardFooter>
    </Card>
  );
}

export default AuthCard;