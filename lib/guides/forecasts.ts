/**
 * Forecasts Page Guide
 * Comprehensive guide for the Forecasts page
 */

import type { PageGuide } from "./types";

export const forecastsGuide: PageGuide = {
  pageId: "forecasts",
  title: "Forecasts & Predictions",
  description: "AI-powered forecasting for narrative drift, outbreak probability, and what-if simulations powered by Graph Neural Networks",
  
  quickStart: [
    {
      id: "forecasts-quick-1",
      type: "tooltip",
      title: "Welcome to Forecasts",
      description: "This page provides AI-powered predictions about narrative evolution. Start by exploring the Overview tab to see all active forecasts.",
      targetSelector: "[data-guide='forecasts-header']",
      position: "bottom",
    },
    {
      id: "forecasts-quick-2",
      type: "tooltip",
      title: "Forecast Types",
      description: "Switch between tabs to explore different forecast types: Overview, Sentiment Drift, Outbreak Probability, and What-If Simulations.",
      targetSelector: "[data-guide='forecasts-tabs']",
      position: "bottom",
    },
  ],

  sections: [
    {
      id: "overview-section",
      title: "Forecast Overview",
      description: "Understanding the forecast dashboard and key metrics",
      order: 1,
      steps: [
        {
          id: "forecast-overview-1",
          type: "tooltip",
          title: "Forecast List",
          description: "View all active forecasts sorted by recency. Each forecast shows type, value, confidence level, and time horizon.",
          targetSelector: "[data-guide='forecast-list']",
          position: "right",
        },
        {
          id: "forecast-overview-2",
          type: "tooltip",
          title: "Forecast Types",
          description: "DRIFT: Predicts sentiment or attention movement. OUTBREAK: Estimates narrative virality probability. ANOMALY: Detects unusual patterns.",
          targetSelector: "[data-guide='forecast-types']",
          position: "top",
        },
        {
          id: "forecast-overview-3",
          type: "tooltip",
          title: "Confidence Levels",
          description: "Confidence indicates forecast reliability. Higher confidence (0.8+) means more reliable predictions based on historical accuracy.",
          targetSelector: "[data-guide='confidence-indicator']",
          position: "left",
        },
      ],
    },
    {
      id: "drift-section",
      title: "Sentiment Drift Analysis",
      description: "Understanding and using drift forecasts",
      order: 2,
      steps: [
        {
          id: "drift-1",
          type: "modal",
          title: "What is Sentiment Drift?",
          description: "Sentiment drift detects consistent movement in sentiment or attention before it becomes a crisis. It analyzes historical patterns to predict future trends.",
          content: "Drift analysis compares current sentiment metrics against historical baselines. When drift magnitude exceeds thresholds, it signals potential narrative shifts that may require attention.",
        },
        {
          id: "drift-2",
          type: "tooltip",
          title: "Drift Metrics",
          description: "Current Sentiment: Latest measured value. Predicted Sentiment: Forecasted value. Drift Magnitude: Size of the change. Trend: Direction (increasing/decreasing/stable).",
          targetSelector: "[data-guide='drift-metrics']",
          position: "top",
        },
        {
          id: "drift-3",
          type: "tooltip",
          title: "Drift Chart",
          description: "Visualize sentiment trends over time. The chart shows historical data, current position, and predicted trajectory.",
          targetSelector: "[data-guide='drift-chart']",
          position: "bottom",
        },
      ],
    },
    {
      id: "outbreak-section",
      title: "Outbreak Probability",
      description: "Predicting narrative virality and outbreak scenarios",
      order: 3,
      steps: [
        {
          id: "outbreak-1",
          type: "modal",
          title: "Outbreak Forecasting",
          description: "Outbreak probability estimates the chance a narrative will go viral over a specified time horizon based on observed signals, amplification patterns, and network effects.",
          content: "The model analyzes signal amplification, sentiment trends, cluster growth, and historical outbreak patterns. Higher probability (>0.7) indicates elevated risk requiring proactive response.",
        },
        {
          id: "outbreak-2",
          type: "tooltip",
          title: "Narrative Forecasts",
          description: "View forecasts for specific narratives, including surface (platform), region, and probability. Click to see detailed analysis.",
          targetSelector: "[data-guide='narrative-forecasts']",
          position: "right",
        },
        {
          id: "outbreak-3",
          type: "tooltip",
          title: "Heatmap",
          description: "Visual heatmap showing outbreak probability across different narratives and time periods. Darker colors indicate higher risk.",
          targetSelector: "[data-guide='outbreak-heatmap']",
          position: "bottom",
        },
      ],
    },
    {
      id: "simulation-section",
      title: "What-If Simulations",
      description: "Running scenario simulations with Graph Neural Networks",
      order: 4,
      steps: [
        {
          id: "simulation-1",
          type: "modal",
          title: "What-If Simulations",
          description: "Simulate scenarios to predict outcomes. For example: 'What if we publish a response artifact addressing the top cluster?' The GNN model predicts narrative impact.",
          content: "Enter a scenario description and time horizon. The system uses Graph Neural Networks to model how the scenario would affect the belief graph, sentiment, and narrative evolution.",
        },
        {
          id: "simulation-2",
          type: "tooltip",
          title: "Scenario Input",
          description: "Describe your scenario in natural language. Examples: 'Publish response to top cluster', 'Launch new campaign', 'Address negative narrative'.",
          targetSelector: "[data-guide='scenario-input']",
          position: "top",
        },
        {
          id: "simulation-3",
          type: "tooltip",
          title: "Time Horizon",
          description: "Set how far into the future to simulate (1-30 days). Longer horizons show broader trends but with lower confidence.",
          targetSelector: "[data-guide='time-horizon']",
          position: "top",
        },
        {
          id: "simulation-4",
          type: "tooltip",
          title: "Run Simulation",
          description: "Click to run the simulation. Results show predicted impact on sentiment, cluster growth, and narrative evolution.",
          targetSelector: "[data-guide='run-simulation']",
          position: "top",
        },
      ],
    },
    {
      id: "advanced-section",
      title: "Advanced Features",
      description: "Accuracy metrics, content packs, and explainability",
      order: 5,
      steps: [
        {
          id: "advanced-1",
          type: "tooltip",
          title: "Accuracy Metrics",
          description: "View historical forecast accuracy to assess model performance. Higher accuracy means more reliable predictions.",
          targetSelector: "[data-guide='accuracy-metrics']",
          position: "left",
        },
        {
          id: "advanced-2",
          type: "tooltip",
          title: "Content Packs",
          description: "Pre-built content recommendations based on forecasts. Use these to prepare responses for predicted scenarios.",
          targetSelector: "[data-guide='content-packs']",
          position: "right",
        },
        {
          id: "advanced-3",
          type: "tooltip",
          title: "Explain Score",
          description: "Click 'Explain' on any forecast to see detailed reasoning behind the prediction, including key factors and confidence breakdown.",
          targetSelector: "[data-guide='explain-score']",
          position: "top",
        },
      ],
    },
  ],

  apiEndpoints: [
    {
      method: "GET",
      path: "/api/forecasts",
      description: "Fetch all forecasts for the tenant",
      example: { forecasts: [] },
    },
    {
      method: "GET",
      path: "/api/forecasts?type=drift",
      description: "Get drift analysis with sentiment trends",
      example: { forecasts: [], analysis: { currentSentiment: 0.65, driftMagnitude: 0.12 } },
    },
    {
      method: "GET",
      path: "/api/forecasts?type=narrative",
      description: "Get narrative-specific outbreak forecasts",
      example: { forecasts: [{ narrative: "product-quality", probability: 0.75 }] },
    },
    {
      method: "GET",
      path: "/api/forecasts/heatmap",
      description: "Get heatmap data for outbreak visualization",
    },
    {
      method: "GET",
      path: "/api/forecasts/accuracy",
      description: "Get historical accuracy metrics",
    },
    {
      method: "GET",
      path: "/api/forecasts/content-packs",
      description: "Get recommended content packs based on forecasts",
    },
    {
      method: "POST",
      path: "/api/forecasts",
      description: "Create a new forecast (drift or outbreak)",
      example: { type: "drift", metric: "sentiment", horizon_days: 7, baseline_data: [0.5, 0.6, 0.55] },
    },
    {
      method: "GET",
      path: "/api/scores/explain",
      description: "Get detailed explanation for a forecast score",
    },
  ],

  features: [
    {
      name: "Drift Detection",
      description: "AI-powered detection of sentiment and attention drift before it becomes a crisis",
      icon: "TrendingUp",
    },
    {
      name: "Outbreak Prediction",
      description: "Estimate narrative virality probability using Graph Neural Networks and signal amplification",
      icon: "AlertTriangle",
    },
    {
      name: "What-If Simulations",
      description: "Simulate scenarios to predict narrative impact using GNN models",
      icon: "BarChart3",
    },
    {
      name: "Accuracy Tracking",
      description: "Monitor forecast accuracy over time to assess model reliability",
      icon: "CheckCircle2",
    },
    {
      name: "Content Recommendations",
      description: "Get pre-built content packs based on forecast predictions",
      icon: "Package",
    },
    {
      name: "Explainable AI",
      description: "Understand forecast reasoning with detailed explanations and confidence breakdowns",
      icon: "Info",
    },
  ],

  workflow: [
    {
      step: 1,
      title: "Monitor Overview",
      description: "Start by reviewing the Overview tab to see all active forecasts and their current status",
      action: "Navigate to Overview tab",
    },
    {
      step: 2,
      title: "Analyze Drift",
      description: "Check Sentiment Drift tab to identify trends that may require attention",
      action: "Review drift metrics and charts",
    },
    {
      step: 3,
      title: "Assess Outbreak Risk",
      description: "Examine Outbreak Probability tab to identify high-risk narratives",
      action: "Review narrative forecasts and heatmap",
    },
    {
      step: 4,
      title: "Run Simulations",
      description: "Use What-If Simulations to predict impact of potential actions",
      action: "Enter scenario and run simulation",
    },
    {
      step: 5,
      title: "Take Action",
      description: "Use content packs and recommendations to prepare responses",
      action: "Review content packs and create artifacts in Studio",
    },
  ],
};
