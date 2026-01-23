/**
 * Case Management Dashboard
 * 
 * Internal dashboard for viewing and managing cases.
 * Requires authentication.
 */

import { Metadata } from "next";
import { CasesList } from "@/components/cases-list";

export const metadata: Metadata = {
  title: "Cases | Holdwall",
  description: "Manage and track financial services cases",
};

export default function CasesPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Case Management</h1>
        <p className="text-muted-foreground">
          View and manage all financial services cases
        </p>
      </div>

      <CasesList />
    </div>
  );
}
