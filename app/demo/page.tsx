import { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { DemoWalkthroughClient } from "@/components/demo-walkthrough-client";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta(
  "Interactive Demo - Complete Platform Walkthrough",
  "Experience the complete Holdwall POS platform with our step-by-step interactive walkthrough. 52 comprehensive steps covering all 18 sections from authentication to publishing—no account required.",
  "/demo"
);

export default async function DemoPage() {
  return (
    <SiteShell>
      <div className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Interactive Platform Demo</h1>
          <p className="max-w-2xl text-muted-foreground leading-7">
            Experience the complete Holdwall POS platform with our step-by-step interactive walkthrough. 
            See every feature from authentication to publishing—no account required.
          </p>
        </div>
        <DemoWalkthroughClient />
      </div>
    </SiteShell>
  );
}
