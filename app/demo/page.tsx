import { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { DemoWalkthroughClient } from "@/components/demo-walkthrough-client";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta(
  "Interactive Demo - Complete Platform Walkthrough",
  "Experience the complete Holdwall POS platform with our interactive walkthrough. Navigate through 15 comprehensive categories covering every feature from authentication to financial services—no account required.",
  "/demo"
);

export default async function DemoPage() {
  return (
    <SiteShell>
      <div className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Interactive Platform Demo</h1>
          <p className="max-w-2xl text-muted-foreground leading-7">
            Experience the complete Holdwall POS platform with our interactive walkthrough. 
            Navigate through 15 comprehensive categories covering everything from authentication to financial services—no account required. 
            Complete all steps in each category before moving to the next, or use auto-play to experience the full journey.
          </p>
        </div>
        <DemoWalkthroughClient />
      </div>
    </SiteShell>
  );
}
