# Certification status - Grouped Indicator Table

**Publisher:** Obliwise
**Submitted:** 24 August 2026 (v1.0.0.0) - awaiting review outcome

## Known risks, from the Accent KPI Card review (25 August 2026)

### 1180.2.2 Core Functions - resize - expected to pass

`style/visual.less` already sets `overflow: auto` on the root container, so the table gains
scroll bars when the host shrinks it. This is the behaviour the reviewers asked for on
Accent KPI Card. Worth re-testing at small sizes before assuming it passes.

### 1180.2.2.2 Tool Tips - soft failure expected

The visual does not use the host tooltip service.

### 1180.2.2.3 Filter Out - passes

Clicking a row cross-filters the page through `ISelectionManager`, with Ctrl+click for
multi-select.
