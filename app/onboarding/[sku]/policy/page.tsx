"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, AlertTriangle } from "lucide-react";

export default function PolicyPage() {
  const router = useRouter();
  const params = useParams();
  const sku = (params.sku as string)?.toUpperCase() || "A";

  const [riskPolicy, setRiskPolicy] = useState("");
  const [decisiveNegatives, setDecisiveNegatives] = useState("");

  const policyTemplates = {
    A: {
      riskPolicy: `If claim includes "fraud" or "scam" + rising velocity → High severity
If topic is "data breach" → Route to Security + Legal
If complaint is "fees" → Route to Ops + Comms with templated explanation`,
      decisiveNegatives: `- Claims of fraud or illegal activity
- Data breach or security incidents
- Regulatory violations`,
    },
    B: {
      riskPolicy: `If claim includes "fraud/scam" + rising velocity → Escalate to Risk + Legal
If claim references "regulator" → Executive visibility required
If claim mentions "data breach" → Security loop-in
If claim indicates "already resolved" → Auto-downgrade
Outbreak probability > 0.7 → Immediate alert
Anomaly detected → Trigger preemption playbook
Drift > 2σ → Escalate to Trust & Safety`,
      decisiveNegatives: `- Claims of fraud or illegal activity
- Data breach or security incidents
- Regulatory violations
- Narrative velocity > 100 mentions/hour
- Outbreak probability > 0.8
- Coordinated attack patterns`,
    },
    C: {
      riskPolicy: `Allegations with evidence → Create case file
Unverified claims → Route for verification
High-stakes claims → Require legal approval`,
      decisiveNegatives: `- Unsubstantiated allegations
- Claims outside jurisdiction
- Duplicate cases`,
    },
  };

  const template = policyTemplates[sku as keyof typeof policyTemplates] || policyTemplates.A;

  const handleUseTemplate = () => {
    setRiskPolicy(template.riskPolicy);
    setDecisiveNegatives(template.decisiveNegatives);
  };

  const handleContinue = async () => {
    if (!riskPolicy.trim() || !decisiveNegatives.trim()) {
      alert("Please define both risk policy and decisive negatives");
      return;
    }

    try {
      const response = await fetch("/api/onboarding/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku,
          risk_policy: riskPolicy,
          decisive_negatives: decisiveNegatives,
        }),
      });

      if (response.ok) {
        router.push(`/onboarding/${sku.toLowerCase()}/brief`);
      }
    } catch (error) {
      // Error handling is done in the API route
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Define Risk Policy</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Set up your risk rules and non-starters
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Risk Policy</CardTitle>
            <CardDescription>
              Define escalation rules and routing logic
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Risk Policy Rules</Label>
                  <Button variant="outline" size="sm" onClick={handleUseTemplate}>
                    Use Template
                  </Button>
                </div>
                <Textarea
                  placeholder="Define your risk policy rules..."
                  value={riskPolicy}
                  onChange={(e) => setRiskPolicy(e.target.value)}
                  rows={6}
                />
              </div>

              <div>
                <Label>Decisive Negatives (Non-Starters)</Label>
                <Textarea
                  placeholder="Define hard disqualifiers..."
                  value={decisiveNegatives}
                  onChange={(e) => setDecisiveNegatives(e.target.value)}
                  rows={4}
                  className="mt-2"
                />
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                  These are claims that automatically trigger high-priority responses
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => router.push(`/onboarding/${sku.toLowerCase()}/sources`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleContinue}>
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
