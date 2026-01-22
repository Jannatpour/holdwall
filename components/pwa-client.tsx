"use client";

import dynamic from "next/dynamic";

// InstallPrompt is client-only, load dynamically
const InstallPrompt = dynamic(() => import("@/lib/pwa/install-prompt").then((mod) => mod.InstallPrompt), {
  ssr: false,
});

// ServiceWorker registration is client-only
const ServiceWorkerRegistration = dynamic(() => import("@/lib/pwa/service-worker").then((mod) => ({ default: mod.ServiceWorkerRegistration })), {
  ssr: false,
});

export function PWAClient() {
  return (
    <>
      <InstallPrompt />
      <ServiceWorkerRegistration />
    </>
  );
}
