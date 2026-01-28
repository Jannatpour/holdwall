import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";
import { Shield, Lock, Key, Database, Network, CheckCircle2, AlertTriangle, FileCheck } from "@/components/demo-icons";

export const metadata: Metadata = genMeta(
  "Security",
  "Enterprise-grade security, compliance, and data protection. SOC 2, GDPR, CCPA compliant with end-to-end encryption, role-based access controls, and comprehensive audit trails.",
  "/security"
);

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="mb-4" variant="outline">
            Enterprise Security
          </Badge>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Security, compliance, and data protection
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Enterprise-grade security built for regulated industries. SOC 2, GDPR, CCPA compliant 
            with end-to-end encryption, role-based access controls, comprehensive audit trails, and 
            adversarial narrative security protections.
          </p>
        </div>
      </section>

      {/* Security Features */}
      <section className="border-y bg-muted/50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Security features
            </h2>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "End-to-End Encryption",
                description: "All data encrypted at rest and in transit with AES-256 and TLS 1.3.",
                icon: Lock,
              },
              {
                title: "Role-Based Access Control",
                description: "Granular permissions with RBAC and ABAC for fine-grained access control.",
                icon: Key,
              },
              {
                title: "Multi-Factor Authentication",
                description: "MFA required for all accounts with support for TOTP and hardware keys.",
                icon: Shield,
              },
              {
                title: "Data Isolation",
                description: "Complete tenant isolation with encrypted storage and secure multi-tenancy.",
                icon: Database,
              },
              {
                title: "Network Security",
                description: "DDoS protection, rate limiting, and WAF with comprehensive threat detection.",
                icon: Network,
              },
              {
                title: "Audit Logging",
                description: "Comprehensive audit trails with immutable logs and one-click export.",
                icon: FileCheck,
              },
              {
                title: "Adversarial Narrative Security",
                description: "Protection against retrieval poisoning, prompt injection, synthetic content campaigns, and credential stripping.",
                icon: AlertTriangle,
              },
            ].map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <feature.icon className="mb-2 size-8 text-primary" />
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

      {/* Compliance */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Compliance & certifications
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Built for regulated industries and global compliance requirements
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: "SOC 2 Type II", status: "Certified" },
              { name: "GDPR", status: "Compliant" },
              { name: "CCPA", status: "Compliant" },
              { name: "HIPAA", status: "Ready" },
            ].map((cert) => (
              <Card key={cert.name}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{cert.name}</CardTitle>
                    <Badge variant="outline" className="text-green-600">
                      {cert.status}
                    </Badge>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Security Practices */}
      <section className="border-y bg-muted/50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Security practices
            </h2>
          </div>
          <div className="mt-16 space-y-8">
            {[
              {
                title: "Vulnerability Management",
                description: "Regular security audits, penetration testing, and automated vulnerability scanning.",
              },
              {
                title: "Incident Response",
                description: "24/7 security monitoring with rapid incident response and breach notification procedures.",
              },
              {
                title: "Data Retention",
                description: "Configurable data retention policies with automatic deletion and archival options.",
              },
              {
                title: "Backup & Recovery",
                description: "Automated backups with geo-redundant storage and point-in-time recovery capabilities.",
              },
            ].map((practice) => (
              <Card key={practice.title}>
                <CardHeader>
                  <CardTitle>{practice.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{practice.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Request security documentation
          </h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Get our security whitepaper, compliance reports, and SOC 2 audit results.
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
