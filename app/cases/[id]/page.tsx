/**
 * Case Detail Page
 * 
 * View full case details, evidence, resolution plan, and timeline.
 */

import { Metadata } from "next";
import { CaseDetail } from "@/components/case-detail";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Case ${id} | Holdwall`,
    description: "View case details and resolution plan",
  };
}

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CaseDetail caseId={id} />;
}
