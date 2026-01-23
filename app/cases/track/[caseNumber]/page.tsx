/**
 * Customer Portal - Case Tracking Page
 * 
 * Public route (no auth required) for customers to track their cases.
 * Uses case number + email verification for access.
 */

import { Metadata } from "next";
import { CaseTracker } from "@/components/case-tracker";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Track Your Case | Holdwall",
  description: "Track the status of your submitted case",
};

interface PageProps {
  params: Promise<{ caseNumber: string }>;
}

export default async function CaseTrackPage({ params }: PageProps) {
  const { caseNumber } = await params;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Track Your Case</h1>
          <p className="text-muted-foreground text-lg">
            Enter your case number and email to view your case status and updates.
          </p>
        </div>

        <CaseTracker initialCaseNumber={caseNumber} />
      </div>
    </div>
  );
}
