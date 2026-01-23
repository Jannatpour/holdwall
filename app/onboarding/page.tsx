"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Shield, MessageSquare, FileText, Sparkles } from "lucide-react";

type SKUType = "A" | "B" | "C" | "D" | null;

export default function OnboardingPage() {
  const router = useRouter();
  const [selectedSKU, setSelectedSKU] = useState<SKUType>(null);

  const handleContinue = () => {
    if (selectedSKU) {
      router.push(`/onboarding/${selectedSKU.toLowerCase()}/sources`);
    }
  };

  const skus = [
    {
      id: "A" as const,
      title: "AI Answer Monitoring & Authority",
      description: "Become the most cited source about your own criticism",
      icon: MessageSquare,
      features: [
        "Monitor AI answer snapshots",
        "Detect claim clusters",
        "Generate evidence-backed rebuttals",
        "Measure answer shifts",
      ],
      useCase: "Brands, Comms, Marketing",
    },
    {
      id: "B" as const,
      title: "Narrative Risk Early Warning",
      description: "Detect and defuse narrative outbreaks before virality",
      icon: Shield,
      features: [
        "Outbreak forecasting (Hawkes + graph)",
        "Anomaly detection + drift",
        "Preemption playbooks",
        "Security incident integration",
        "Timed publishing",
      ],
      useCase: "Financial, Regulated, Trust & Safety",
    },
    {
      id: "C" as const,
      title: "Evidence-Backed Intake & Case Triage",
      description: "Turn inbound allegations into verifiable, provable case files",
      icon: FileText,
      features: [
        "Evidence bundle generator",
        "Claim verification packets",
        "Structured exports",
        "CRM handoff",
      ],
      useCase: "Legal, Claims, Incident Response",
    },
    {
      id: "D" as const,
      title: "Security Incident Narrative Management",
      description: "When security incidents happen, govern how AI systems understand and communicate about them",
      icon: Shield,
      features: [
        "Security tool webhook integration",
        "Automated narrative risk assessment",
        "AI-governed incident explanations",
        "Multi-stakeholder approvals",
        "AI citation tracking",
      ],
      useCase: "CISO, Security, AI Governance",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Welcome to Holdwall POS</h1>
          <p className="text-xl text-slate-600 dark:text-slate-400">
            Choose your primary use case to get started
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {skus.map((sku) => {
            const Icon = sku.icon;
            const isSelected = selectedSKU === sku.id;

            return (
              <Card
                key={sku.id}
                className={`cursor-pointer transition-all ${
                  isSelected
                    ? "ring-2 ring-blue-500 shadow-lg scale-105"
                    : "hover:shadow-md"
                }`}
                onClick={() => setSelectedSKU(sku.id)}
              >
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={`p-2 rounded-lg ${
                        isSelected ? "bg-blue-100 dark:bg-blue-900" : "bg-slate-100 dark:bg-slate-800"
                      }`}
                    >
                      <Icon
                        className={`h-6 w-6 ${
                          isSelected ? "text-blue-600 dark:text-blue-400" : "text-slate-600 dark:text-slate-400"
                        }`}
                      />
                    </div>
                    {isSelected && <CheckCircle2 className="h-5 w-5 text-blue-500 ml-auto" />}
                  </div>
                  <CardTitle className="text-xl">{sku.title}</CardTitle>
                  <CardDescription>{sku.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      Best for: {sku.useCase}
                    </div>
                    <ul className="space-y-2">
                      {sku.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Sparkles className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleContinue}
            disabled={!selectedSKU}
            className="min-w-[200px]"
          >
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>You can add more SKUs later. Each SKU uses the same POS backbone.</p>
        </div>
      </div>
    </div>
  );
}
