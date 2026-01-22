# Signals Page Guide

## Overview

The **Signals** page provides a real-time streaming feed of ingested signals from all connected sources. Signals are evidence items that represent narrative activity across channels like social media, news, support tickets, reviews, and more.

## Key Features

### 1. Real-Time Streaming
- **Server-Sent Events (SSE)**: Signals update automatically without page refresh
- **Connection Status**: Monitor connection health with visual indicator
- **Live Updates**: New signals appear at the top of the feed instantly

### 2. Advanced Filtering
- **Search**: Search across signal content and source types
- **Source Filter**: Filter by Reddit, Twitter/X, Reviews, Support, News, Forums
- **Severity Filter**: Filter by Critical, High, Medium, Low
- **Language Filter**: Filter by language (English, Spanish, French, German)
- **Timeframe Filter**: Filter by Last Hour, 24 Hours, 7 Days, 30 Days

### 3. Tab-Based Views
- **All Signals**: Complete feed of all signals
- **High Risk**: Only signals marked as high-risk
- **Unclustered**: Signals not yet linked to claim clusters

### 4. Signal Actions
- **Link to Cluster**: Manually link signal to existing claim cluster
- **Create Cluster**: Create new claim cluster from signal
- **Mark High Risk**: Flag important signals for priority attention

### 5. Signal Details
- **Raw Content**: Original unprocessed content
- **Normalized Content**: Processed and cleaned content
- **Extracted Claims**: AI-extracted claims from signal
- **Evidence**: Source URLs and attachments with provenance

### 6. AI-Powered Analysis
- **Cluster Suggestions**: AI-recommended cluster assignments
- **Duplicate Detection**: Identifies likely duplicate signals
- **Amplification Tracking**: Monitors signal amplification across channels
- **Source Health**: Real-time health status for all data sources

## API Endpoints

### GET /api/signals
Fetch signals with optional filters.

**Query Parameters**:
- `source`: Filter by source type (reddit, twitter, etc.)
- `severity`: Filter by severity (critical, high, medium, low)
- `language`: Filter by language code (en, es, fr, de)
- `timeframe`: Filter by time (1h, 24h, 7d, 30d)
- `limit`: Limit results (1-1000, default 100)
- `evidence`: Fetch specific signal by evidence ID

**Response**:
```json
[
  {
    "evidence_id": "...",
    "source": {
      "type": "reddit",
      "id": "...",
      "url": "https://...",
      "collected_at": "2024-01-01T00:00:00Z"
    },
    "content": {
      "raw": "...",
      "normalized": "..."
    },
    "metadata": {
      "severity": "high",
      "suggested_cluster_id": "...",
      "high_risk": false
    },
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

### GET /api/signals/stream
Server-Sent Events stream for real-time signal updates.

**Response**: SSE stream with events:
```json
{
  "type": "signal",
  "evidence_id": "...",
  "timestamp": "2024-01-01T00:00:00Z",
  "payload": {...}
}
```

### GET /api/sources/health
Get health status for all configured sources.

**Response**:
```json
{
  "sources": [
    {
      "source_type": "reddit",
      "status": "healthy",
      "last_success": "2024-01-01T00:00:00Z",
      "error_rate": 0.05
    }
  ]
}
```

### POST /api/signals/actions
Perform actions on signals.

**Request Body**:
```json
{
  "action": "link_to_cluster",
  "evidence_id": "...",
  "cluster_id": "..."
}
```

**Actions**:
- `link_to_cluster`: Link signal to existing cluster
- `create_cluster`: Create new cluster from signal
- `mark_high_risk`: Mark/unmark signal as high-risk

### POST /api/signals/amplification
Get amplification metrics for signals.

**Request Body**:
```json
{
  "evidence_ids": ["...", "..."]
}
```

**Response**:
```json
{
  "amplification": {
    "evidence_id": [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1]
  }
}
```

## Workflow

1. **Monitor Feed**: Watch real-time signal feed for new evidence
2. **Filter and Search**: Use filters to find signals of interest
3. **Review Details**: Click signals to view details, claims, and evidence
4. **Link to Clusters**: Link signals to existing clusters or create new ones
5. **Flag High Risk**: Mark important signals for priority attention

## Best Practices

1. **Regular Monitoring**: Check signals feed multiple times daily
2. **Use Filters**: Leverage filters to focus on relevant signals
3. **Review AI Suggestions**: Check suggested clusters but verify manually
4. **Flag High Risk**: Mark critical signals immediately
5. **Check Source Health**: Monitor source health to ensure data quality
6. **Review Amplification**: High amplification scores indicate growing attention

## Tips

- **Connection Status**: Green indicator means real-time updates are active
- **Suggested Clusters**: AI suggestions are helpful but not always accurate
- **Dedup Likely**: Signals marked as duplicates may be safe to ignore
- **Amplification**: Scores >1.0 indicate significant amplification
- **Source Health**: Unhealthy sources may need attention or reconfiguration
