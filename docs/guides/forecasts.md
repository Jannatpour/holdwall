# Forecasts Page Guide

## Overview

The **Forecasts** page provides AI-powered predictions about narrative evolution, sentiment drift, outbreak probability, and scenario simulations. This page helps you anticipate narrative risks before they become crises.

## Key Features

### 1. Forecast Overview
- **Purpose**: View all active forecasts in one place
- **Forecast Types**:
  - **DRIFT**: Predicts sentiment or attention movement
  - **OUTBREAK**: Estimates narrative virality probability
  - **ANOMALY**: Detects unusual patterns
- **Metrics**: Each forecast shows value, confidence level, and time horizon

### 2. Sentiment Drift Analysis
- **What it does**: Detects consistent movement in sentiment or attention before it becomes a crisis
- **How it works**: Compares current sentiment metrics against historical baselines
- **Key Metrics**:
  - Current Sentiment: Latest measured value
  - Predicted Sentiment: Forecasted value
  - Drift Magnitude: Size of the change
  - Trend: Direction (increasing/decreasing/stable)

### 3. Outbreak Probability
- **What it does**: Estimates the chance a narrative will go viral over a specified time horizon
- **How it works**: Analyzes signal amplification, sentiment trends, cluster growth, and historical outbreak patterns
- **Risk Levels**:
  - Low (<0.3): Minimal risk
  - Medium (0.3-0.7): Moderate risk, monitor closely
  - High (>0.7): Elevated risk, requires proactive response

### 4. What-If Simulations
- **What it does**: Simulate scenarios to predict outcomes
- **How it works**: Uses Graph Neural Networks to model how scenarios affect the belief graph, sentiment, and narrative evolution
- **Use Cases**:
  - "What if we publish a response artifact addressing the top cluster?"
  - "What if we launch a new campaign?"
  - "What if we address a negative narrative?"

## API Endpoints

### GET /api/forecasts
Fetch all forecasts for the tenant.

**Query Parameters**:
- `type`: Filter by type (drift, narrative, outbreak, anomaly)

**Response**:
```json
{
  "forecasts": [
    {
      "id": "...",
      "type": "DRIFT",
      "value": 0.65,
      "confidenceLevel": 0.85,
      "horizonDays": 7,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### GET /api/forecasts?type=drift
Get drift analysis with sentiment trends.

**Response**:
```json
{
  "forecasts": [...],
  "analysis": {
    "currentSentiment": 0.65,
    "predictedSentiment": 0.72,
    "driftMagnitude": 0.12,
    "confidence": 0.85,
    "trend": "increasing"
  }
}
```

### GET /api/forecasts?type=narrative
Get narrative-specific outbreak forecasts.

**Response**:
```json
{
  "forecasts": [
    {
      "narrative": "product-quality",
      "surface": "twitter",
      "region": "global",
      "probability": 0.75,
      "horizon_days": 7,
      "confidence": 0.82
    }
  ]
}
```

### GET /api/forecasts/heatmap
Get heatmap data for outbreak visualization.

### GET /api/forecasts/accuracy
Get historical accuracy metrics.

### GET /api/forecasts/content-packs
Get recommended content packs based on forecasts.

### POST /api/forecasts
Create a new forecast.

**Request Body**:
```json
{
  "type": "drift",
  "metric": "sentiment",
  "horizon_days": 7,
  "baseline_data": [0.5, 0.6, 0.55]
}
```

### GET /api/scores/explain
Get detailed explanation for a forecast score.

## Workflow

1. **Monitor Overview**: Start by reviewing the Overview tab to see all active forecasts
2. **Analyze Drift**: Check Sentiment Drift tab to identify trends
3. **Assess Outbreak Risk**: Examine Outbreak Probability tab for high-risk narratives
4. **Run Simulations**: Use What-If Simulations to predict impact of actions
5. **Take Action**: Use content packs and recommendations to prepare responses

## Best Practices

1. **Regular Monitoring**: Check forecasts daily to stay ahead of narrative shifts
2. **Focus on High Confidence**: Prioritize forecasts with confidence >0.8
3. **Use Simulations**: Test scenarios before taking action
4. **Review Accuracy**: Monitor accuracy metrics to assess model reliability
5. **Act on Outbreaks**: High outbreak probability (>0.7) requires immediate attention

## Tips

- **Drift Magnitude**: Values >0.15 indicate significant shifts
- **Outbreak Probability**: Values >0.7 signal elevated risk
- **Time Horizon**: Longer horizons (30 days) show trends but with lower confidence
- **Content Packs**: Use pre-built content recommendations for common scenarios
- **Explain Score**: Always review explanations to understand forecast reasoning
