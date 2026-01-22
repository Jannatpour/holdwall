"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // NextAuth v5 defaults to /api/auth, no need to set basePath explicitly
  // Setting it can cause routing issues if not configured correctly
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
