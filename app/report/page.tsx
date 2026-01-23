/**
 * Public Case Intake Page
 * 
 * Public route (no auth required) for submitting cases.
 * Rate-limited and includes privacy notice.
 */

import { Metadata } from "next";
import { CaseIntakeFormI18n } from "@/components/case-intake-form-i18n";

export const metadata: Metadata = {
  title: "Report an Issue | Holdwall",
  description: "Submit a case for dispute, fraud, outage, or complaint resolution",
};

export default function ReportPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Report an Issue</h1>
          <p className="text-muted-foreground text-lg">
            Submit a case for resolution. Our autonomous system will triage and route your case appropriately.
          </p>
        </div>

        <CaseIntakeFormI18n />
      </div>
    </div>
  );
}
