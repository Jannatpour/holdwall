/**
 * Guide System Types
 * Type definitions for the interactive guide system
 */

export type GuideId = 
  | "overview"
  | "signals"
  | "claims"
  | "graph"
  | "forecasts"
  | "studio"
  | "playbooks"
  | "funnel"
  | "trust"
  | "governance"
  | "integrations"
  | "metering"
  | "ai-answer-monitor";

export type GuideStepType = "tooltip" | "highlight" | "modal" | "inline" | "walkthrough";

export interface GuideStep {
  id: string;
  type: GuideStepType;
  title: string;
  description: string;
  content?: string;
  targetSelector?: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  prerequisites?: string[];
  metadata?: Record<string, unknown>;
}

export interface GuideSection {
  id: string;
  title: string;
  description: string;
  steps: GuideStep[];
  order: number;
}

export interface PageGuide {
  pageId: GuideId;
  title: string;
  description: string;
  sections: GuideSection[];
  quickStart?: GuideStep[];
  apiEndpoints?: Array<{
    method: string;
    path: string;
    description: string;
    example?: unknown;
  }>;
  features?: Array<{
    name: string;
    description: string;
    icon?: string;
  }>;
  workflow?: Array<{
    step: number;
    title: string;
    description: string;
    action?: string;
  }>;
}

export interface GuideProgress {
  guideId: GuideId;
  completedSteps: string[];
  currentStep?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface GuideState {
  activeGuide?: GuideId;
  activeStep?: string;
  completedGuides: GuideId[];
  progress: Record<GuideId, GuideProgress>;
  dismissed: GuideId[];
}
