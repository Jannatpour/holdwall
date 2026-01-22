"use client";

/**
 * Auth Guard Component
 * Protects routes by checking authentication status
 */

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: "USER" | "ADMIN" | "APPROVER" | "VIEWER";
  fallback?: React.ReactNode;
}

export function AuthGuard({ children, requiredRole, fallback }: AuthGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin?callbackUrl=" + encodeURIComponent(window.location.pathname));
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      fallback || (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )
    );
  }

  if (status === "unauthenticated") {
    return null; // Will redirect
  }

  if (!session?.user) {
    return null; // Will redirect
  }

  // Check role if required
  if (requiredRole) {
    const userRole = (session.user as any)?.role;
    const roleHierarchy: Record<string, number> = {
      VIEWER: 1,
      USER: 2,
      APPROVER: 3,
      ADMIN: 4,
    };

    const userRoleLevel = roleHierarchy[userRole] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

    if (userRoleLevel < requiredRoleLevel) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-semibold">Access Denied</h2>
            <p className="text-muted-foreground">
              You don&apos;t have permission to access this page. Required role: {requiredRole}
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
