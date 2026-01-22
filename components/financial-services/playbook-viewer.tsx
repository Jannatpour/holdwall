"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Building2,
  Shield,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  TrendingUp,
  BarChart3,
  Lock,
  Target,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import Link from "next/link";

export function FinancialServicesPlaybookViewer() {
  const [activeSection, setActiveSection] = React.useState<string | null>(null);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(sectionId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-blue-600" />
            <div className="flex-1">
              <CardTitle className="text-2xl">POS for Financial Services</CardTitle>
              <CardDescription className="text-base mt-1">
                Complete Business Operating Playbook for Banks · FinTech · Payments · Insurance
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              <Shield className="mr-2 h-4 w-4" />
              Enterprise-Ready
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground italic">
            This playbook is exhaustive, non-marketing, and written for direct use in enterprise
            sales, onboarding, compliance review, and executive briefings.
          </p>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Table of Contents */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Contents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-300px)]">
              <nav className="space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left"
                  onClick={() => scrollToSection("why-buy")}
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  1. Why Financial Institutions Buy POS
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left"
                  onClick={() => scrollToSection("who-uses")}
                >
                  <Users className="mr-2 h-4 w-4" />
                  2. Who Uses POS Inside a Financial Institution
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left"
                  onClick={() => scrollToSection("use-cases")}
                >
                  <Target className="mr-2 h-4 w-4" />
                  3. What Financial Institutions Use POS For
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left"
                  onClick={() => scrollToSection("day1")}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Day 1: Visibility, Control, and Safety
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left"
                  onClick={() => scrollToSection("day7")}
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Day 7: Authority, Control, and De-Escalation
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left"
                  onClick={() => scrollToSection("day30")}
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Day 30: Governance, Proof, and Institutionalization
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left"
                  onClick={() => scrollToSection("deliverables")}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  5. What Financial Institutions Receive
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left"
                  onClick={() => scrollToSection("long-term")}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  6. Why Financial Institutions Keep POS
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left"
                  onClick={() => scrollToSection("one-sentence")}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  7. One-Sentence Explanation
                </Button>
              </nav>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Section 1: Why Financial Institutions Buy POS */}
          <Card id="why-buy">
            <CardHeader>
              <CardTitle className="text-xl">1. Why Financial Institutions Buy POS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Financial institutions operate in an environment where{" "}
                <strong>trust is fragile, narratives spread faster than facts, and AI systems
                increasingly influence decisions</strong>.
              </p>

              <div>
                <h4 className="font-semibold mb-2">Traditional tools fail because they:</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>React too late</li>
                  <li>Fragment ownership across PR, Legal, Risk, and Support</li>
                  <li>Cannot prove impact</li>
                  <li>Cannot control AI-generated summaries and interpretations</li>
                </ul>
              </div>

              <Alert variant="default" className="border-blue-200 bg-blue-50 dark:bg-blue-950">
                <AlertTriangle className="h-4 w-4 text-blue-600" />
                <div className="ml-2">
                  <div className="font-semibold text-blue-900 dark:text-blue-100">
                    POS exists to solve one core financial problem:
                  </div>
                  <div className="text-blue-800 dark:text-blue-200 mt-1 italic">
                    &ldquo;How your institution is perceived directly affects deposits, churn,
                    regulatory scrutiny, fraud exposure, and long-term brand equity.&rdquo;
                  </div>
                </div>
              </Alert>

              <p className="text-muted-foreground">
                POS turns <strong>narrative risk</strong> into a{" "}
                <strong>measurable, governable, auditable operational domain</strong>.
              </p>
            </CardContent>
          </Card>

          {/* Section 2: Who Uses POS */}
          <Card id="who-uses">
            <CardHeader>
              <CardTitle className="text-xl">
                2. Who Uses POS Inside a Financial Institution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                POS is not owned by one department—it is <strong>shared infrastructure</strong>{" "}
                with clear role boundaries.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Primary Economic Owner
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Head of Brand Risk / Reputation / Trust</li>
                      <li>• Chief Risk Officer (CRO) in some institutions</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Mandatory Co-Owners
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Legal & Compliance</li>
                      <li>• Fraud & Risk Operations</li>
                      <li>• Customer Support / CX Leadership</li>
                      <li>• Security (for fraud / breach narratives)</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Executive Consumers</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• CEO / COO</li>
                    <li>• Board Risk Committee</li>
                    <li>• Regulatory Liaison Teams</li>
                  </ul>
                </CardContent>
              </Card>

              <Alert>
                <Shield className="h-4 w-4" />
                <div className="ml-2">
                  <div className="font-semibold">Role-Based Access</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    POS is designed so each group sees only what they are responsible for, while
                    all activity remains provable and auditable.
                  </div>
                </div>
              </Alert>
            </CardContent>
          </Card>

          {/* Section 3: Use Cases */}
          <Card id="use-cases">
            <CardHeader>
              <CardTitle className="text-xl">
                3. What Financial Institutions Use POS For (Exact Use Cases)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                POS is used to manage <strong>high-impact narrative categories</strong> that
                directly affect financial stability:
              </p>

              <div>
                <h4 className="font-semibold mb-3">Core Narrative Classes</h4>
                <div className="grid md:grid-cols-2 gap-2">
                  {[
                    "Scam / fraud accusations",
                    "Account freezes / fund holds",
                    "Hidden fees / unfair pricing",
                    "Transaction failures",
                    "Insurance claim denials",
                    "Data privacy concerns",
                    "Regulatory or legal allegations",
                    "Platform outages / reliability concerns",
                  ].map((category, idx) => (
                    <Badge key={idx} variant="outline" className="justify-start p-2">
                      <AlertTriangle className="mr-2 h-3 w-3" />
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Why These Matter</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>They influence <strong>customer churn</strong></li>
                  <li>They trigger <strong>regulatory scrutiny</strong></li>
                  <li>They affect <strong>AI-generated answers and summaries</strong></li>
                  <li>They drive <strong>support volume and legal cost</strong></li>
                  <li>They shape <strong>investor and partner confidence</strong></li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Day 1 Workflow */}
          <Card id="day1">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                Day 1 — Visibility, Control, and Safety
              </CardTitle>
              <CardDescription>Create immediate situational awareness and eliminate blind spots</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="step1">
                  <AccordionTrigger>Step 1: Select the Financial Risk Operating Mode</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground mb-3">
                      The institution enables the <strong>Narrative Risk Early Warning</strong>{" "}
                      configuration.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      This automatically activates:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4 mt-2">
                      <li>Financial-grade governance</li>
                      <li>Legal approval gates</li>
                      <li>Higher evidence thresholds</li>
                      <li>Conservative publishing defaults</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step2">
                  <AccordionTrigger>Step 2: Connect Initial Data Sources (Deliberately Limited)</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground mb-3">
                      POS <strong>does not</strong> require full data ingestion on Day 1.
                    </p>
                    <p className="text-sm font-semibold mb-2">Typical initial sources:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                      <li>Public social channels (Reddit, X, forums)</li>
                      <li>Review platforms</li>
                      <li>Customer support tickets</li>
                      <li>Incident/status logs</li>
                      <li>Existing public FAQs and policy documents</li>
                    </ul>
                    <p className="text-sm text-muted-foreground mt-3 italic">
                      <strong>Why limited:</strong> Immediate value without operational disruption.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step3">
                  <AccordionTrigger>Step 3: Define Non-Starters & Escalation Rules</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground mb-3">
                      The institution defines <strong>hard rules</strong> that prevent wasted
                      effort and legal exposure.
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <ArrowRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span>
                          If claim indicates &ldquo;already resolved&rdquo; → auto-downgrade
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <ArrowRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span>
                          If claim mentions &ldquo;fraud/scam&rdquo; → escalate to Risk + Legal
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <ArrowRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span>
                          If claim references &ldquo;regulator&rdquo; → executive visibility
                          required
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <ArrowRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span>
                          If claim references &ldquo;data breach&rdquo; → Security loop-in
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-3">
                      POS enforces these rules automatically.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step4">
                  <AccordionTrigger>Step 4: Receive the First &ldquo;Perception Brief&rdquo;</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground mb-3">
                      Within hours, POS delivers:
                    </p>
                    <div className="space-y-3">
                      <div>
                        <h5 className="font-semibold text-sm mb-2">What&apos;s Inside the Perception Brief</h5>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                          <li>Top emerging narrative clusters</li>
                          <li>Severity and velocity scoring</li>
                          <li>Which narratives are growing vs decaying</li>
                          <li>Which channels are amplifying risk</li>
                          <li>Initial outbreak probability</li>
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-semibold text-sm mb-2">Who Sees What</h5>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                          <li>
                            <strong>Comms:</strong> narrative summaries
                          </li>
                          <li>
                            <strong>Legal:</strong> risk flags
                          </li>
                          <li>
                            <strong>Executives:</strong> one-page risk snapshot
                          </li>
                        </ul>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <div className="ml-2">
                  <div className="font-semibold text-green-900 dark:text-green-100">
                    Day 1 Business Outcome
                  </div>
                  <ul className="text-sm text-green-800 dark:text-green-200 mt-1 space-y-1">
                    <li>• The institution <strong>knows what is forming</strong></li>
                    <li>• No guessing, no social media panic</li>
                    <li>• Executives have immediate visibility</li>
                  </ul>
                </div>
              </Alert>
            </CardContent>
          </Card>

          {/* Day 7 Workflow */}
          <Card id="day7">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-yellow-600" />
                Day 7 — Authority, Control, and De-Escalation
              </CardTitle>
              <CardDescription>
                Replace speculation and emotion with verified, authoritative explanations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="step5">
                  <AccordionTrigger>Step 5: Select a High-Risk Narrative Cluster</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm font-semibold mb-2">Example clusters:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                      <li>&ldquo;Bank froze my account&rdquo;</li>
                      <li>&ldquo;Payment app scam&rdquo;</li>
                      <li>&ldquo;Insurance refuses to pay&rdquo;</li>
                      <li>&ldquo;Hidden fees&rdquo;</li>
                    </ul>
                    <p className="text-sm text-muted-foreground mt-3">
                      POS presents: All related claims, sub-claims, supporting and contradicting
                      evidence, confidence and uncertainty indicators.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step6">
                  <AccordionTrigger>Step 6: Generate Evidence-Backed Explanations</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground mb-3">
                      POS produces <strong>multiple outputs from the same evidence spine</strong>:
                    </p>
                    <div className="space-y-3">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">A. Public-Facing Explanation</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                            <li>Clear, calm language</li>
                            <li>Transparent metrics</li>
                            <li>Policy references</li>
                            <li>Time-bound updates</li>
                          </ul>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">B. Internal Risk Brief</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                            <li>Root cause</li>
                            <li>Exposure assessment</li>
                            <li>Regulatory implications</li>
                          </ul>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">C. Support Playbooks</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                            <li>Response macros</li>
                            <li>De-escalation language</li>
                            <li>Escalation criteria</li>
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step7">
                  <AccordionTrigger>Step 7: Legal & Compliance Review (In-System)</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground mb-3">
                      Legal does not receive a PDF. They see:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                      <li>Evidence sources</li>
                      <li>Claim structure</li>
                      <li>Exact language to be published</li>
                      <li>Approval context</li>
                    </ul>
                    <p className="text-sm font-semibold mt-3 mb-2">All approvals are:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                      <li>Timestamped</li>
                      <li>Versioned</li>
                      <li>Auditable</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step8">
                  <AccordionTrigger>Step 8: Publish with Confidence</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground mb-3">
                      POS coordinates publication to:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                      <li>Public trust or transparency pages</li>
                      <li>Knowledge bases</li>
                      <li>Partner communications</li>
                      <li>Internal staff guidance</li>
                    </ul>
                    <p className="text-sm font-semibold mt-3 mb-2">The content is structured to be:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                      <li>Understandable to humans</li>
                      <li>Trustworthy to AI systems</li>
                      <li>Traceable to evidence</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step9">
                  <AccordionTrigger>Step 9: Measure Immediate Impact</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground mb-3">POS tracks:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                      <li>Narrative velocity change</li>
                      <li>Support ticket deflection</li>
                      <li>Shift in AI summaries and answers</li>
                      <li>Reduction in escalation language</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <div className="ml-2">
                  <div className="font-semibold text-green-900 dark:text-green-100">
                    Day 7 Business Outcome
                  </div>
                  <ul className="text-sm text-green-800 dark:text-green-200 mt-1 space-y-1">
                    <li>• The institution <strong>owns the explanation</strong></li>
                    <li>• Legal risk is controlled</li>
                    <li>• Support volume stabilizes</li>
                    <li>• Narratives stop accelerating</li>
                  </ul>
                </div>
              </Alert>
            </CardContent>
          </Card>

          {/* Day 30 Workflow */}
          <Card id="day30">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-green-600" />
                Day 30 — Governance, Proof, and Institutionalization
              </CardTitle>
              <CardDescription>
                Make narrative control part of financial risk governance, not a one-off response
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="step10">
                  <AccordionTrigger>Step 10: Monthly Impact & Risk Report</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground mb-3">
                      POS generates executive-ready reports showing:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                      <li>Outbreaks prevented</li>
                      <li>Time-to-resolution improvements</li>
                      <li>Reduced negative AI interpretations</li>
                      <li>Support cost reduction</li>
                      <li>Legal exposure mitigation</li>
                    </ul>
                    <p className="text-sm text-muted-foreground mt-3 italic">
                      This report is board-safe.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step11">
                  <AccordionTrigger>Step 11: Preemption Playbooks Go Live</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground mb-3">
                      POS begins <strong>predictive operations</strong>:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                      <li>Detects early signal drift</li>
                      <li>Forecasts likely future complaints</li>
                      <li>Pre-publishes explanations before escalation</li>
                    </ul>
                    <Card className="mt-3 border-blue-200 bg-blue-50 dark:bg-blue-950">
                      <CardContent className="pt-4">
                        <p className="text-sm italic text-blue-900 dark:text-blue-100">
                          Example: &ldquo;We are aware of intermittent payment delays and have
                          already implemented corrective actions.&rdquo;
                        </p>
                        <p className="text-xs text-blue-800 dark:text-blue-200 mt-2">
                          Customers see responsibility, not silence.
                        </p>
                      </CardContent>
                    </Card>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step12">
                  <AccordionTrigger>Step 12: Regulatory & Audit Readiness</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground mb-3">When required, POS exports:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                      <li>Evidence bundles</li>
                      <li>Approval trails</li>
                      <li>Publication history</li>
                      <li>Impact metrics</li>
                    </ul>
                    <p className="text-sm font-semibold mt-3 mb-2">This supports:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                      <li>Regulatory exams</li>
                      <li>Internal audits</li>
                      <li>Legal inquiries</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <div className="ml-2">
                  <div className="font-semibold text-green-900 dark:text-green-100">
                    Day 30 Business Outcome
                  </div>
                  <ul className="text-sm text-green-800 dark:text-green-200 mt-1 space-y-1">
                    <li>• Narrative risk becomes <strong>measurable and manageable</strong></li>
                    <li>• Executives trust the system</li>
                    <li>• Regulators see proactive governance</li>
                    <li>• The institution stops reacting and starts leading</li>
                  </ul>
                </div>
              </Alert>
            </CardContent>
          </Card>

          {/* Deliverables */}
          <Card id="deliverables">
            <CardHeader>
              <CardTitle className="text-xl">5. What Financial Institutions Physically Receive</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                By Day 30, the institution has:
              </p>
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  "Daily / Weekly Perception Briefs",
                  "Verified Evidence Vault",
                  "Authoritative Public Explanations",
                  "Legal-Grade Audit Trails",
                  "Forecasts of Emerging Narrative Risk",
                  "Measured Impact on Trust and Cost",
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-3 border rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Long-term Value */}
          <Card id="long-term">
            <CardHeader>
              <CardTitle className="text-xl">
                6. Why Financial Institutions Keep POS Long-Term
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">POS becomes:</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Part of <strong>risk governance</strong></li>
                  <li>Part of <strong>regulatory posture</strong></li>
                  <li>Part of <strong>executive decision-making</strong></li>
                  <li>Part of <strong>AI-era brand protection</strong></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">It replaces:</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Fragmented monitoring tools</li>
                  <li>Manual war rooms</li>
                  <li>Reactive PR cycles</li>
                  <li>Unprovable &ldquo;reputation management&rdquo;</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* One-Sentence Explanation */}
          <Card id="one-sentence" className="border-blue-200 bg-blue-50 dark:bg-blue-950">
            <CardHeader>
              <CardTitle className="text-xl">7. One-Sentence Explanation (For Financial Executives)</CardTitle>
            </CardHeader>
            <CardContent>
              <blockquote className="text-lg italic text-blue-900 dark:text-blue-100 border-l-4 border-blue-600 pl-4 py-2">
                &ldquo;POS gives us a governed, auditable way to see narrative risk early, explain
                issues transparently, and prove that trust was protected—before regulators or AI
                systems decide for us.&rdquo;
              </blockquote>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Related Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-3">
                <Button variant="outline" className="justify-start" asChild>
                  <Link href="/financial-services?tab=workflow">
                    <Clock className="mr-2 h-4 w-4" />
                    View Workflow Progress
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start" asChild>
                  <Link href="/financial-services?tab=brief">
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Perception Brief
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start" asChild>
                  <Link href="/financial-services?tab=narratives">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Review Narrative Clusters
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start" asChild>
                  <Link href="/governance">
                    <Shield className="mr-2 h-4 w-4" />
                    Configure Governance
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
