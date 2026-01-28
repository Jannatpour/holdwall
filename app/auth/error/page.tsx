"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Shield } from "@/components/demo-icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function AuthErrorPage() {
  const [error, setError] = useState("Unknown");
  const [callbackUrl, setCallbackUrl] = useState("/overview");

  // Avoid `useSearchParams` so the page doesn't get stuck on a Suspense fallback in prod
  // if hydration fails for any reason (CSP, blocked scripts, runtime errors, etc).
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const nextError = params.get("error") || "Unknown";
      const nextCallbackUrl = params.get("callbackUrl") || "/overview";
      // Defer state updates to avoid setState-in-effect lint rule and reduce cascading renders.
      queueMicrotask(() => {
        setError(nextError);
        setCallbackUrl(nextCallbackUrl);
      });
    } catch {
      queueMicrotask(() => {
        setError("Unknown");
        setCallbackUrl("/overview");
      });
    }
  }, []);

  const message = useMemo(() => {
    switch (error) {
      case "Configuration":
        return "Authentication is not configured correctly. Please contact support.";
      case "AccessDenied":
        return "Access denied. You may not have permission to sign in with this account.";
      case "OAuthSignin":
      case "OAuthCallback":
      case "OAuthAccountNotLinked":
        return "There was an issue signing in with the selected provider. Please try again or use email and password.";
      case "CredentialsSignin":
        return "Invalid email or password. Please try again.";
      case "SessionRequired":
        return "Your session has expired. Please sign in again.";
      default:
        return "An authentication error occurred. Please try again.";
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Shield className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Sign in issue</h1>
          <p className="text-muted-foreground">We couldn’t complete authentication.</p>
        </div>

        <Card className="border-2 shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold">Authentication error</CardTitle>
            <CardDescription className="text-sm">You can try again or go back to sign in.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm font-medium">{message}</AlertDescription>
            </Alert>

            <div className="grid gap-3">
              <Button asChild className="w-full h-11 text-base font-medium shadow-sm">
                <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to sign in
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full h-11 border-2">
                <Link href="/">Go to homepage</Link>
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Error code: <span className="font-mono">{error}</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

