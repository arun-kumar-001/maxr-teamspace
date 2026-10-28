# Frontend Feature Template (`apps/web/src/features/_template`)

This folder provides the reference pattern for frontend features in MAXR Teamspace.
Every business module (e.g. `employees`, `attendance`, `leave`, `tasks`) must follow this directory layout.

## Feature Folder Structure

```
features/<module>/
├── api/            # API call functions (fetch/TanStack Query)
├── components/     # Module-specific UI components
├── hooks/          # Custom state/data hooks
├── pages/          # Full page views mounted in router
├── types/          # Feature-specific TypeScript models/DTOs
└── README.md       # Feature documentation
```

## Mandatory UI Quality Standards (AGENTS.md §8)

1. **Mandatory UI States for Every Data View:**
   - **Loading State:** Skeleton loader or indicator.
   - **Empty State:** Clear message with actionable button (e.g. "No records yet. Create one").
   - **Error State:** Human-readable message with retry trigger and request ID.
   - **Access Denied State:** 403 Forbidden screen (do not leak hidden data).
   - **Validation State:** Inline form field errors with helpful error guidance.

2. **Responsive Layout Rules:**
   - Design **mobile-first**, then scale up.
   - Mobile (320–639px): Single column, 44×44px touch targets, full-width forms.
   - Tablet (640–1023px): 1–2 columns, tables with column priorities.
   - Desktop (1024–1535px): Multi-column layouts, full tables.
   - Ultrawide (≥1536px): Expanded grids, capped readable text lines (≈70ch).
   - No horizontal page scroll at any resolution.

