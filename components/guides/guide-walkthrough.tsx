/**
 * Guide Walkthrough Component
 * Manages step-by-step walkthroughs for guides
 */

"use client";

import React, { useEffect, useState, useMemo } from "react";
import { GuideTooltip } from "./guide-tooltip";
import { GuideModal } from "./guide-modal";
import { useGuide } from "./guide-provider";
import { getGuide } from "@/lib/guides/registry";
import type { GuideId, GuideStep } from "@/lib/guides/types";

interface GuideWalkthroughProps {
  pageId: GuideId;
}

export function GuideWalkthrough({ pageId }: GuideWalkthroughProps) {
  const { state, isGuideActive, completeStep, stopGuide } = useGuide();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  const guide = getGuide(pageId);
  const isActive = isGuideActive(pageId);

  // Get all steps from all sections
  const allSteps = useMemo(() => {
    if (!guide) return [];
    
    const steps: Array<{ step: GuideStep; sectionId: string; stepIndex: number }> = [];
    
    // Add quick start steps first
    if (guide.quickStart) {
      guide.quickStart.forEach((step, idx) => {
        steps.push({ step, sectionId: "quickstart", stepIndex: idx });
      });
    }
    
    // Add section steps
    guide.sections.forEach((section) => {
      section.steps.forEach((step, idx) => {
        steps.push({ step, sectionId: section.id, stepIndex: idx });
      });
    });
    
    return steps;
  }, [guide]);

  const currentStepData = allSteps[currentStepIndex];
  const currentStep = currentStepData?.step;

  useEffect(() => {
    if (!isActive || allSteps.length === 0) {
      return;
    }

    // Reset to first step when guide starts
    setCurrentStepIndex(0);
    setCurrentSectionIndex(0);
  }, [isActive, allSteps.length]);

  const handleComplete = () => {
    if (!currentStep) return;
    
    completeStep(pageId, currentStep.id);
    
    // Move to next step
    if (currentStepIndex < allSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      // Guide complete
      stopGuide();
    }
  };

  const handleNext = () => {
    if (currentStepIndex < allSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      stopGuide();
    }
  };

  const handleDismiss = () => {
    stopGuide();
  };

  if (!isActive || !currentStep || !guide) {
    return null;
  }

  const showNext = currentStepIndex < allSteps.length - 1;

  // Render based on step type
  if (currentStep.type === "modal") {
    return (
      <GuideModal
        step={currentStep}
        isOpen={true}
        onComplete={handleComplete}
        onDismiss={handleDismiss}
        onNext={showNext ? handleNext : undefined}
        showNext={showNext}
      />
    );
  }

  // Default to tooltip for other types
  return (
    <GuideTooltip
      step={currentStep}
      isActive={true}
      onComplete={handleComplete}
      onDismiss={handleDismiss}
      onNext={showNext ? handleNext : undefined}
      showNext={showNext}
    />
  );
}
