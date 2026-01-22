import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";
import { FileCheck, Shield, Lock, Globe, CheckCircle2, AlertTriangle } from "lucide-react";

export const metadata: Metadata = genMeta(
  "Compliance",
  "Regulatory compliance information for GDPR, CCPA, HIPAA, SOC 2, and other standards. Built for regulated industries with comprehensive compliance features.",
  "/compliance"
);

export default function CompliancePage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="mb-4" variant="outline">
            Regulatory Compliance
          </Badge>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Compliance & regulatory standards
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Built for regulated industries with comprehensive compliance features, 
            audit trails, and support for GDPR, CCPA, HIPAA, and SOC 2.
          </p>
        </div>
      </section>

      {/* Compliance Standards */}
      <section className="border-y bg-muted/50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Compliance standards
            </h2>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "GDPR",
                description: "EU General Data Protection Regulation compliance with data subject rights, consent management, and data portability.",
                icon: Globe,
                status: "Compliant",
              },
              {
                title: "CCPA",
                description: "California Consumer Privacy Act compliance with opt-out mechanisms and data deletion requests.",
                icon: Shield,
                status: "Compliant",
              },
              {
                title: "HIPAA",
                description: "Health Insurance Portability and Accountability Act ready with BAA support and PHI safeguards.",
                icon: Lock,
                status: "Ready",
              },
              {
                title: "SOC 2 Type II",
                description: "Service Organization Control 2 certification for security, availability, and confidentiality.",
                icon: FileCheck,
                status: "Certified",
              },
              {
                title: "ISO 27001",
                description: "Information security management system certification (in progress).",
                icon: CheckCircle2,
                status: "In Progress",
              },
              {
                title: "PCI DSS",
                description: "Payment Card Industry Data Security Standard compliance for payment processing.",
                icon: Shield,
                status: "Ready",
              },
            ].map((standard) => (
              <Card key={standard.title}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <standard.icon className="size-8 text-primary" />
                    <Badge variant={standard.status === "Compliant" || standard.status === "Certified" ? "default" : "outline"}>
                      {standard.status}
                    </Badge>
                  </div>
                  <CardTitle className="mt-4">{standard.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{standard.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance Features */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Compliance features
            </h2>
          </div>
          <div className="mt-16 space-y-8">
            {[
              {
                title: "Data Subject Rights",
                description: "Support for GDPR Article 15-22 rights including access, rectification, erasure, and data portability.",
              },
              {
                title: "Consent Management",
                description: "Granular consent tracking with opt-in/opt-out mechanisms and consent withdrawal.",
              },
              {
                title: "Data Retention Policies",
                description: "Configurable retention periods with automatic deletion and archival capabilities.",
              },
              {
                title: "Audit Trails",
                description: "Comprehensive logging of all data access, modifications, and deletions for compliance reporting.",
              },
              {
                title: "Data Residency",
                description: "Support for data residency requirements with region-specific data storage options.",
              },
              {
                title: "Breach Notification",
                description: "Automated breach detection and notification procedures compliant with regulatory requirements.",
              },
            ].map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-y bg-muted/50 py-24">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Request compliance documentation
          </h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Get our compliance reports, certifications, and data processing agreements.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/auth/signin">Request Documentation</Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
