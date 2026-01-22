# Holdwall POS - Interactive Guide System

## Overview

The Holdwall POS Interactive Guide System provides comprehensive, context-aware guidance for every page in the application. It helps users understand features, workflows, and best practices through interactive tooltips, walkthroughs, and detailed documentation.

## Architecture

### Core Components

1. **Guide Registry** (`lib/guides/registry.ts`)
   - Central registry for all page guides
   - Provides guide lookup and management

2. **Guide Types** (`lib/guides/types.ts`)
   - TypeScript definitions for guides, steps, and state
   - Ensures type safety across the system

3. **Guide Loader** (`lib/guides/loader.ts`)
   - Loads and initializes guides
   - Handles guide registration

4. **Guide Provider** (`components/guides/guide-provider.tsx`)
   - React context for guide state management
   - Handles guide progress, completion, and dismissal
   - Persists state to localStorage

5. **Guide Components**
   - **GuideButton**: Button to start/control guides
   - **GuideWalkthrough**: Manages step-by-step walkthroughs
   - **GuideTooltip**: Contextual tooltips with positioning
   - **GuideModal**: Modal dialogs for detailed explanations

### Guide Structure

Each guide includes:
- **Quick Start**: Initial steps to get started
- **Sections**: Organized groups of related steps
- **Steps**: Individual guidance items (tooltip, modal, highlight)
- **API Endpoints**: Documentation of related APIs
- **Features**: List of key features
- **Workflow**: Step-by-step workflow guide

## Usage

### For Users

1. **Start a Guide**: Click the "Guide" button in the top-right of any page
2. **Follow Steps**: Progress through tooltips and modals
3. **Skip Steps**: Click "Skip" to skip individual steps
4. **Dismiss Guide**: Dismiss guides you don't want to see again
5. **View Documentation**: Access full documentation via the guide menu

### For Developers

#### Adding a New Guide

1. Create guide file in `lib/guides/[pageId].ts`:

```typescript
import type { PageGuide } from "./types";

export const myPageGuide: PageGuide = {
  pageId: "my-page",
  title: "My Page",
  description: "Description of the page",
  quickStart: [...],
  sections: [...],
  apiEndpoints: [...],
  features: [...],
  workflow: [...],
};
```

2. Register in `lib/guides/loader.ts`:

```typescript
import { myPageGuide } from "./my-page";

const guideModules: Record<GuideId, () => PageGuide> = {
  // ... existing guides
  "my-page": () => myPageGuide,
};
```

3. Add guide button to page:

```tsx
import { GuideButton, GuideWalkthrough } from "@/components/guides";

export default function MyPage() {
  return (
    <AppShell>
      <GuideWalkthrough pageId="my-page" />
      <div>
        <GuideButton pageId="my-page" />
        {/* page content */}
      </div>
    </AppShell>
  );
}
```

4. Add data-guide attributes to key elements:

```tsx
<div data-guide="my-element">
  {/* content */}
</div>
```

5. Create documentation in `docs/guides/[pageId].md`

#### Guide Step Types

- **tooltip**: Contextual tooltip pointing to an element
- **modal**: Modal dialog for detailed explanations
- **highlight**: Highlights an element
- **inline**: Inline help text
- **walkthrough**: Multi-step walkthrough

## Features

### Interactive Tooltips
- Smart positioning (top, bottom, left, right, center)
- Viewport-aware positioning
- Element highlighting
- Skip and complete actions

### Progress Tracking
- Tracks completed steps
- Persists to localStorage
- Shows progress per guide
- Dismissal tracking

### Real-Time Updates
- Guides update as you interact
- Context-aware step progression
- Dynamic content based on state

### Documentation Integration
- Links to full documentation
- API endpoint documentation
- Workflow guides
- Best practices

## Best Practices

1. **Keep Steps Focused**: Each step should explain one concept
2. **Use Appropriate Types**: Tooltips for quick tips, modals for detailed explanations
3. **Add Data Attributes**: Use `data-guide` attributes for targeting
4. **Update Documentation**: Keep markdown docs in sync with guides
5. **Test Guides**: Verify tooltips position correctly and steps flow well

## File Structure

```
holdwall/
├── lib/
│   └── guides/
│       ├── types.ts          # Type definitions
│       ├── registry.ts       # Guide registry
│       ├── loader.ts         # Guide loader
│       ├── forecasts.ts      # Forecasts guide
│       └── signals.ts        # Signals guide
├── components/
│   └── guides/
│       ├── guide-provider.tsx    # Context provider
│       ├── guide-button.tsx      # Guide button
│       ├── guide-walkthrough.tsx # Walkthrough manager
│       ├── guide-tooltip.tsx     # Tooltip component
│       ├── guide-modal.tsx       # Modal component
│       └── index.tsx             # Exports
├── app/
│   └── api/
│       └── guides/
│           └── route.ts      # Guide API
└── docs/
    └── guides/
        ├── README.md         # This file
        ├── forecasts.md      # Forecasts documentation
        └── signals.md       # Signals documentation
```

## API

### GET /api/guides
Get all guides or a specific guide.

**Query Parameters**:
- `pageId`: Optional, get specific guide

**Response**:
```json
{
  "guides": [...]
}
```

## Future Enhancements

- [ ] Video tutorials integration
- [ ] Interactive demos
- [ ] A/B testing for guide effectiveness
- [ ] Analytics on guide completion
- [ ] Multi-language support
- [ ] Accessibility improvements
- [ ] Mobile-optimized guides
