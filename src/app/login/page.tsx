"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Providers = Record<string, { id: string; name: string }>;

function safeCallbackUrl(raw: string | null): string {
  const fallback = "/dashboard";
  if (!raw || typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  try {
    if (typeof window === "undefined") return fallback;
    const parsed = new URL(trimmed, window.location.origin);
    if (parsed.origin === window.location.origin) return parsed.pathname + parsed.search;
  } catch {
    /* invalid URL */
  }
  return fallback;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl")) || "/dashboard";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [providers, setProviders] = useState<Providers | null>(null);
  const [showSimulationForm, setShowSimulationForm] = useState(false);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then(setProviders)
      .catch(() => setProviders({}));
  }, []);

  const hasGoogle = providers?.google != null;
  const hasSimulation = providers?.["google-simulation"] != null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      setError("Email and password required");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid credentials");
      setLoading(false);
      return;
    }
    router.push(callbackUrl);
  }

  async function handleOAuth(providerId: string) {
    setOauthLoading(providerId);
    setError("");
    if (providerId === "google-simulation") {
      setShowSimulationForm(true);
      setOauthLoading(null);
      return;
    }
    await signIn(providerId, { callbackUrl });
    setOauthLoading(null);
  }

  async function handleSimulationSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = String(new FormData(form).get("sim-email") ?? "").trim();
    const password = String(new FormData(form).get("sim-password") ?? "");
    if (!email || !password) {
      setError("Email and password required");
      return;
    }
    setLoading(true);
    setError("");
    const result = await signIn("google-simulation", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Invalid credentials");
    } else if (result?.ok) {
      router.push(callbackUrl);
    }
  }

  return (
    <div className="space-y-4">
      {(hasGoogle || hasSimulation) && (
        <div className="space-y-2">
          {hasGoogle && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={!!oauthLoading}
              onClick={() => handleOAuth("google")}
            >
              {oauthLoading === "google" ? "Redirecting…" : "Sign in with Google"}
            </Button>
          )}
          {hasSimulation &&
            (showSimulationForm ? (
              <form
                onSubmit={handleSimulationSubmit}
                className="space-y-2 rounded-lg border border-dashed border-neutral-600 bg-neutral-800/50 p-3"
                data-testid="oauth-simulation-form"
              >
                <p className="text-xs text-neutral-400">Simulate OAuth (dev only)</p>
                <Input
                  name="sim-email"
                  type="email"
                  placeholder="Email"
                  required
                  data-testid="oauth-sim-email"
                />
                <Input
                  name="sim-password"
                  type="password"
                  placeholder="Password"
                  required
                  data-testid="oauth-sim-password"
                />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={loading}>
                    {loading ? "Signing in…" : "Simulate sign in"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSimulationForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full border-dashed"
                disabled={!!oauthLoading}
                onClick={() => handleOAuth("google-simulation")}
                data-testid="oauth-simulation-button"
              >
                Simulate Google (dev)
              </Button>
            ))}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-neutral-600" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-neutral-900 px-2 text-neutral-500">or</span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <Input id="email" name="email" type="email" required autoFocus />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <Input id="password" name="password" type="password" required />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-neutral-400 mt-1">Access the dashboard</p>
        </div>
        <Suspense fallback={<div className="text-center text-neutral-500">Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
