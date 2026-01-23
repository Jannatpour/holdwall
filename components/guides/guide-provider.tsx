/**
 * Guide Provider
 * Context provider for guide system state management
 */

"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { GuideId, GuideState, GuideProgress } from "@/lib/guides/types";

interface GuideContextValue {
  state: GuideState;
  startGuide: (guideId: GuideId) => void;
  stopGuide: () => void;
  completeStep: (guideId: GuideId, stepId: string) => void;
  dismissGuide: (guideId: GuideId) => void;
  isGuideActive: (guideId: GuideId) => boolean;
  isStepCompleted: (guideId: GuideId, stepId: string) => boolean;
  getProgress: (guideId: GuideId) => GuideProgress | undefined;
}

const GuideContext = createContext<GuideContextValue | undefined>(undefined);

export function useGuide() {
  const context = useContext(GuideContext);
  if (!context) {
    throw new Error("useGuide must be used within GuideProvider");
  }
  return context;
}

interface GuideProviderProps {
  children: React.ReactNode;
}

export function GuideProvider({ children }: GuideProviderProps) {
  const [state, setState] = useState<GuideState>(() => {
    const defaultState: GuideState = {
      activeGuide: undefined,
      activeStep: undefined,
      completedGuides: [],
      progress: {} as Record<GuideId, GuideProgress>,
      dismissed: [],
    };

    if (typeof window === "undefined") return defaultState;

    try {
      const saved = window.localStorage.getItem("holdwall-guide-state");
      if (!saved) return defaultState;
      const parsed = JSON.parse(saved) as Partial<GuideState>;
      return { ...defaultState, ...parsed };
    } catch (error) {
      console.error("Failed to load guide state:", error);
      return defaultState;
    }
  });

  // Save state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("holdwall-guide-state", JSON.stringify(state));
    } catch (error) {
      console.error("Failed to save guide state:", error);
    }
  }, [state]);

  const startGuide = useCallback((guideId: GuideId) => {
    setState((prev) => {
      const progress = prev.progress[guideId] || {
        guideId,
        completedSteps: [],
        startedAt: new Date().toISOString(),
      };

      return {
        ...prev,
        activeGuide: guideId,
        progress: {
          ...prev.progress,
          [guideId]: progress,
        },
        dismissed: prev.dismissed.filter((id) => id !== guideId),
      };
    });
  }, []);

  const stopGuide = useCallback(() => {
    setState((prev) => ({
      ...prev,
      activeGuide: undefined,
      activeStep: undefined,
    }));
  }, []);

  const completeStep = useCallback((guideId: GuideId, stepId: string) => {
    setState((prev) => {
      const progress = prev.progress[guideId] || {
        guideId,
        completedSteps: [],
      };

      if (!progress.completedSteps.includes(stepId)) {
        progress.completedSteps.push(stepId);
      }

      return {
        ...prev,
        progress: {
          ...prev.progress,
          [guideId]: progress,
        },
      };
    });
  }, []);

  const dismissGuide = useCallback((guideId: GuideId) => {
    setState((prev) => ({
      ...prev,
      dismissed: [...prev.dismissed.filter((id) => id !== guideId), guideId],
      activeGuide: prev.activeGuide === guideId ? undefined : prev.activeGuide,
    }));
  }, []);

  const isGuideActive = useCallback(
    (guideId: GuideId) => {
      return state.activeGuide === guideId && !state.dismissed.includes(guideId);
    },
    [state.activeGuide, state.dismissed]
  );

  const isStepCompleted = useCallback(
    (guideId: GuideId, stepId: string) => {
      const progress = state.progress[guideId];
      return progress?.completedSteps.includes(stepId) ?? false;
    },
    [state.progress]
  );

  const getProgress = useCallback(
    (guideId: GuideId) => {
      return state.progress[guideId];
    },
    [state.progress]
  );

  const value: GuideContextValue = {
    state,
    startGuide,
    stopGuide,
    completeStep,
    dismissGuide,
    isGuideActive,
    isStepCompleted,
    getProgress,
  };

  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>;
}
