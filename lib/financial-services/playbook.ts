/**
 * Financial Services Operating Playbook
 * 
 * Complete, exhaustive playbook for Financial Services customers
 * Based on the comprehensive operating playbook provided
 */

export interface FinancialServicesPlaybook {
  version: string;
  lastUpdated: string;
  sections: PlaybookSection[];
}

export interface PlaybookSection {
  id: string;
  title: string;
  content: string;
  subsections?: PlaybookSubsection[];
}

export interface PlaybookSubsection {
  id: string;
  title: string;
  content: string;
  steps?: PlaybookStep[];
}

export interface PlaybookStep {
  id: string;
  title: string;
  description: string;
  actions: string[];
  expectedOutcome: string;
}

export class FinancialServicesPlaybookService {
  /**
   * Get complete Financial Services playbook
   */
  getPlaybook(): FinancialServicesPlaybook {
    return {
      version: "1.0.0",
      lastUpdated: "2026-01-21",
      sections: [
        this.getWhySection(),
        this.getWhoSection(),
        this.getWhatSection(),
        this.getDay1Section(),
        this.getDay7Section(),
        this.getDay30Section(),
        this.getDeliverablesSection(),
        this.getLongTermSection(),
        this.getOneSentenceSection(),
      ],
    };
  }

  private getWhySection(): PlaybookSection {
    return {
      id: "why",
      title: "Why Financial Institutions Buy POS",
      content: `Financial institutions operate in an environment where **trust is fragile, narratives spread faster than facts, and AI systems increasingly influence decisions**.

Traditional tools fail because they:
- React too late
- Fragment ownership across PR, Legal, Risk, and Support
- Cannot prove impact
- Cannot control AI-generated summaries and interpretations

**POS exists to solve one core financial problem:**

> *How your institution is perceived directly affects deposits, churn, regulatory scrutiny, fraud exposure, and long-term brand equity.*

POS turns **narrative risk** into a **measurable, governable, auditable operational domain**.`,
    };
  }

  private getWhoSection(): PlaybookSection {
    return {
      id: "who",
      title: "Who Uses POS Inside a Financial Institution",
      content: `POS is not owned by one department—it is **shared infrastructure** with clear role boundaries.

### Primary Economic Owner
- **Head of Brand Risk / Reputation / Trust**
- In some institutions: **Chief Risk Officer (CRO)**

### Mandatory Co-Owners
- **Legal & Compliance**
- **Fraud & Risk Operations**
- **Customer Support / CX Leadership**
- **Security (for fraud / breach narratives)**

### Executive Consumers
- CEO / COO
- Board Risk Committee
- Regulatory Liaison Teams

POS is designed so **each group sees only what they are responsible for**, while all activity remains provable and auditable.`,
    };
  }

  private getWhatSection(): PlaybookSection {
    return {
      id: "what",
      title: "What Financial Institutions Use POS For (Exact Use Cases)",
      content: `POS is used to manage **high-impact narrative categories** that directly affect financial stability:

### Core Narrative Classes
- Scam / fraud accusations
- Account freezes / fund holds
- Hidden fees / unfair pricing
- Transaction failures
- Insurance claim denials
- Data privacy concerns
- Regulatory or legal allegations
- Platform outages / reliability concerns

### Why These Matter
- They influence **customer churn**
- They trigger **regulatory scrutiny**
- They affect **AI-generated answers and summaries**
- They drive **support volume and legal cost**
- They shape **investor and partner confidence**`,
    };
  }

  private getDay1Section(): PlaybookSection {
    return {
      id: "day1",
      title: "DAY 1 — Visibility, Control, and Safety",
      content: `### Objective
Create **immediate situational awareness** and eliminate blind spots.`,
      subsections: [
        {
          id: "day1-step1",
          title: "Step 1: Select the Financial Risk Operating Mode",
          content: `The institution enables the **Narrative Risk Early Warning** configuration.

This automatically activates:
- Financial-grade governance
- Legal approval gates
- Higher evidence thresholds
- Conservative publishing defaults`,
          steps: [
            {
              id: "day1-1-1",
              title: "Enable Financial Services Mode",
              description: "Select SKU B (Narrative Risk Early Warning) during onboarding",
              actions: [
                "Navigate to onboarding flow",
                "Select 'Narrative Risk Early Warning'",
                "System automatically enables Financial Services operating mode",
              ],
              expectedOutcome: "Financial-grade governance activated with legal approval gates",
            },
          ],
        },
        {
          id: "day1-step2",
          title: "Step 2: Connect Initial Data Sources (Deliberately Limited)",
          content: `POS **does not** require full data ingestion on Day 1.

Typical initial sources:
- Public social channels (Reddit, X, forums)
- Review platforms
- Customer support tickets
- Incident/status logs
- Existing public FAQs and policy documents

**Why limited:**
Immediate value without operational disruption.`,
          steps: [
            {
              id: "day1-2-1",
              title: "Connect 3-5 Data Sources",
              description: "Select initial sources for monitoring",
              actions: [
                "Select Reddit, X, or forums",
                "Add review platforms",
                "Connect support ticket system",
                "Link incident/status logs",
                "Import existing FAQs and policies",
              ],
              expectedOutcome: "3-5 sources connected and actively monitoring",
            },
          ],
        },
        {
          id: "day1-step3",
          title: "Step 3: Define Non-Starters & Escalation Rules",
          content: `The institution defines **hard rules** that prevent wasted effort and legal exposure.

Examples:
- If claim indicates "already resolved" → auto-downgrade
- If claim mentions "fraud/scam" → escalate to Risk + Legal
- If claim references "regulator" → executive visibility required
- If claim references "data breach" → Security loop-in

POS enforces these rules automatically.`,
          steps: [
            {
              id: "day1-3-1",
              title: "Define Risk Policy Rules",
              description: "Set up escalation and routing logic",
              actions: [
                "Enter risk policy rules in onboarding form",
                "Define decisive negatives (non-starters)",
                "System parses rules into escalation logic",
                "Rules automatically enforced on all incoming claims",
              ],
              expectedOutcome: "Escalation rules active and enforcing automatically",
            },
          ],
        },
        {
          id: "day1-step4",
          title: "Step 4: Receive the First 'Perception Brief'",
          content: `Within hours, POS delivers:

### What's Inside the Perception Brief
- Top emerging narrative clusters
- Severity and velocity scoring
- Which narratives are growing vs decaying
- Which channels are amplifying risk
- Initial outbreak probability

### Who Sees What
- **Comms:** narrative summaries
- **Legal:** risk flags
- **Executives:** one-page risk snapshot

## Day 1 Business Outcome
- The institution **knows what is forming**
- No guessing, no social media panic
- Executives have immediate visibility`,
          steps: [
            {
              id: "day1-4-1",
              title: "Generate Baseline Perception Brief",
              description: "Create first executive brief with narrative clusters",
              actions: [
                "System analyzes connected sources",
                "Identifies top narrative clusters",
                "Calculates outbreak probability",
                "Categorizes by financial risk type",
                "Routes high-severity clusters to appropriate teams",
              ],
              expectedOutcome: "First Perception Brief delivered with actionable insights",
            },
          ],
        },
      ],
    };
  }

  private getDay7Section(): PlaybookSection {
    return {
      id: "day7",
      title: "DAY 7 — Authority, Control, and De-Escalation",
      content: `### Objective
Replace speculation and emotion with **verified, authoritative explanations**.`,
      subsections: [
        {
          id: "day7-step5",
          title: "Step 5: Select a High-Risk Narrative Cluster",
          content: `Example clusters:
- "Bank froze my account"
- "Payment app scam"
- "Insurance refuses to pay"
- "Hidden fees"

POS presents:
- All related claims
- Sub-claims
- Supporting and contradicting evidence
- Confidence and uncertainty indicators`,
          steps: [
            {
              id: "day7-5-1",
              title: "Review Narrative Clusters",
              description: "Select high-risk cluster for response",
              actions: [
                "View narrative clusters in Financial Services dashboard",
                "Review claim graph and evidence",
                "Identify cluster requiring authoritative explanation",
                "Select cluster for artifact creation",
              ],
              expectedOutcome: "High-risk cluster identified with full evidence context",
            },
          ],
        },
        {
          id: "day7-step6",
          title: "Step 6: Generate Evidence-Backed Explanations",
          content: `POS produces **multiple outputs from the same evidence spine**:

### A. Public-Facing Explanation
- Clear, calm language
- Transparent metrics
- Policy references
- Time-bound updates

### B. Internal Risk Brief
- Root cause
- Exposure assessment
- Regulatory implications

### C. Support Playbooks
- Response macros
- De-escalation language
- Escalation criteria`,
          steps: [
            {
              id: "day7-6-1",
              title: "Create AAAL Artifact",
              description: "Generate evidence-backed explanation in AAAL Studio",
              actions: [
                "Open AAAL Studio",
                "Select narrative cluster",
                "Generate public-facing explanation",
                "Create internal risk brief",
                "Draft support playbook responses",
              ],
              expectedOutcome: "Multiple artifact types created from same evidence",
            },
          ],
        },
        {
          id: "day7-step7",
          title: "Step 7: Legal & Compliance Review (In-System)",
          content: `Legal does not receive a PDF.

They see:
- Evidence sources
- Claim structure
- Exact language to be published
- Approval context

All approvals are:
- Timestamped
- Versioned
- Auditable`,
          steps: [
            {
              id: "day7-7-1",
              title: "Route Through Legal Approval",
              description: "Submit artifact for legal review",
              actions: [
                "Submit artifact for approval",
                "Legal team reviews in-system",
                "View evidence sources and claim structure",
                "Approve or request changes",
                "All approvals timestamped and versioned",
              ],
              expectedOutcome: "Legal approval obtained with full audit trail",
            },
          ],
        },
        {
          id: "day7-step8",
          title: "Step 8: Publish with Confidence",
          content: `POS coordinates publication to:
- Public trust or transparency pages
- Knowledge bases
- Partner communications
- Internal staff guidance

The content is structured to be:
- Understandable to humans
- Trustworthy to AI systems
- Traceable to evidence`,
          steps: [
            {
              id: "day7-8-1",
              title: "Publish Artifact",
              description: "Publish approved artifact to multiple channels",
              actions: [
                "Publish to PADL (public trust page)",
                "Update knowledge base",
                "Distribute to partner communications",
                "Update internal staff guidance",
                "Optional: Include C2PA credentials for provenance",
              ],
              expectedOutcome: "Artifact published across all channels with full traceability",
            },
          ],
        },
        {
          id: "day7-step9",
          title: "Step 9: Measure Immediate Impact",
          content: `POS tracks:
- Narrative velocity change
- Support ticket deflection
- Shift in AI summaries and answers
- Reduction in escalation language

## Day 7 Business Outcome
- The institution **owns the explanation**
- Legal risk is controlled
- Support volume stabilizes
- Narratives stop accelerating`,
          steps: [
            {
              id: "day7-9-1",
              title: "Track Impact Metrics",
              description: "Measure narrative velocity and support deflection",
              actions: [
                "Monitor narrative velocity changes",
                "Track support ticket volume",
                "Measure AI answer shifts",
                "Review escalation language reduction",
                "Generate impact report",
              ],
              expectedOutcome: "Measurable impact on narrative velocity and support costs",
            },
          ],
        },
      ],
    };
  }

  private getDay30Section(): PlaybookSection {
    return {
      id: "day30",
      title: "DAY 30 — Governance, Proof, and Institutionalization",
      content: `### Objective
Make narrative control part of **financial risk governance**, not a one-off response.`,
      subsections: [
        {
          id: "day30-step10",
          title: "Step 10: Monthly Impact & Risk Report",
          content: `POS generates executive-ready reports showing:
- Outbreaks prevented
- Time-to-resolution improvements
- Reduced negative AI interpretations
- Support cost reduction
- Legal exposure mitigation

This report is board-safe.`,
          steps: [
            {
              id: "day30-10-1",
              title: "Generate Monthly Report",
              description: "Create executive-ready impact report",
              actions: [
                "Calculate outbreaks prevented",
                "Measure time-to-resolution improvements",
                "Track AI interpretation shifts",
                "Calculate support cost reduction",
                "Assess legal exposure mitigation",
                "Generate board-ready report",
              ],
              expectedOutcome: "Executive report showing measurable ROI and risk reduction",
            },
          ],
        },
        {
          id: "day30-step11",
          title: "Step 11: Preemption Playbooks Go Live",
          content: `POS begins **predictive operations**:
- Detects early signal drift
- Forecasts likely future complaints
- Pre-publishes explanations before escalation

Example:
> "We are aware of intermittent payment delays and have already implemented corrective actions."

Customers see responsibility, not silence.`,
          steps: [
            {
              id: "day30-11-1",
              title: "Enable Preemption Playbooks",
              description: "Activate predictive narrative management",
              actions: [
                "Enable preemption playbooks",
                "Configure early signal drift detection",
                "Set up forecast-based alerts",
                "Create pre-emptive response templates",
                "Automate pre-publication workflow",
              ],
              expectedOutcome: "Predictive operations active, preventing outbreaks before they form",
            },
          ],
        },
        {
          id: "day30-step12",
          title: "Step 12: Regulatory & Audit Readiness",
          content: `When required, POS exports:
- Evidence bundles
- Approval trails
- Publication history
- Impact metrics

This supports:
- Regulatory exams
- Internal audits
- Legal inquiries

## Day 30 Business Outcome
- Narrative risk becomes **measurable and manageable**
- Executives trust the system
- Regulators see proactive governance
- The institution stops reacting and starts leading`,
          steps: [
            {
              id: "day30-12-1",
              title: "Export Audit Bundle",
              description: "Generate regulatory-ready audit package",
              actions: [
                "Select time range for audit",
                "Export evidence bundles (with Merkle trees if enabled)",
                "Include approval trails",
                "Export publication history",
                "Include impact metrics",
                "Generate regulatory-ready package",
              ],
              expectedOutcome: "Complete audit package ready for regulatory review",
            },
          ],
        },
      ],
    };
  }

  private getDeliverablesSection(): PlaybookSection {
    return {
      id: "deliverables",
      title: "What Financial Institutions Physically Receive",
      content: `By Day 30, the institution has:

1. **Daily / Weekly Perception Briefs**
   - Top narrative clusters
   - Outbreak probability
   - Escalation requirements
   - Recommended actions

2. **Verified Evidence Vault**
   - Immutable evidence storage
   - Full provenance tracking
   - Merkleized bundles (optional)

3. **Authoritative Public Explanations**
   - Evidence-backed artifacts
   - Legal-approved content
   - C2PA credentials (optional)

4. **Legal-Grade Audit Trails**
   - Complete approval history
   - Version control
   - Timestamped decisions

5. **Forecasts of Emerging Narrative Risk**
   - Hawkes process forecasts
   - Anomaly detection
   - Drift analysis

6. **Measured Impact on Trust and Cost**
   - Narrative velocity changes
   - Support ticket deflection
   - AI answer shifts
   - Cost reduction metrics`,
    };
  }

  private getLongTermSection(): PlaybookSection {
    return {
      id: "longterm",
      title: "Why Financial Institutions Keep POS Long-Term",
      content: `POS becomes:
- Part of **risk governance**
- Part of **regulatory posture**
- Part of **executive decision-making**
- Part of **AI-era brand protection**

It replaces:
- Fragmented monitoring tools
- Manual war rooms
- Reactive PR cycles
- Unprovable "reputation management"`,
    };
  }

  private getOneSentenceSection(): PlaybookSection {
    return {
      id: "onesentence",
      title: "One-Sentence Explanation (For Financial Executives)",
      content: `> "POS gives us a governed, auditable way to see narrative risk early, explain issues transparently, and prove that trust was protected—before regulators or AI systems decide for us."`,
    };
  }

  /**
   * Get playbook section by ID
   */
  getSection(sectionId: string): PlaybookSection | null {
    const playbook = this.getPlaybook();
    return playbook.sections.find((s) => s.id === sectionId) || null;
  }

  /**
   * Get playbook step by ID
   */
  getStep(sectionId: string, subsectionId: string, stepId: string): PlaybookStep | null {
    const section = this.getSection(sectionId);
    if (!section || !section.subsections) return null;

    const subsection = section.subsections.find((s) => s.id === subsectionId);
    if (!subsection || !subsection.steps) return null;

    return subsection.steps.find((s) => s.id === stepId) || null;
  }
}

export const playbookService = new FinancialServicesPlaybookService();
