# Certification status - Grouped Indicator Table

**Publisher:** Obliwise
**Submitted:** 24 August 2026 (v1.0.0.0) - no review outcome recorded
**Resubmitted:** 27 August 2026 (v1.2.0.0) - awaiting review outcome

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

### 1180.2.3 Sample File - risk cleared

Pill Toggle Slicer failed this policy on 26 August 2026 because its `.pbiviz` and `.pbix`
slots held different versions. The same mismatch existed here: the sample embedded 1.0.0.0
while the package to submit is 1.2.0.0. `store/grouped-indicator-table-sample.pbix` now
embeds 1.2.0.0, byte-identical to
`dist/groupedIndicatorTable3BCEC6EDD44443449B5E9264E10CD122.1.2.0.0.pbiviz`.

## Full policy audit (26 August 2026)

Audited against the Microsoft certification policies (1180/1200) and the reviewer test list
in "Testing submissions of Power BI custom visuals".

| Reviewer test | Status |
| --- | --- |
| Loads data and renders; convert to/from a native visual | Pass |
| Resize; report size at minimum; scroll bars where needed | **Fixed** - root is `overflow: auto`, content no longer compressed |
| Tooltips on hover, correct after filtering | **Fixed** - host tooltip service, plus the `tooltips` capability |
| Filters outward to other visuals | **Fixed** - selection through `ISelectionManager` |
| Reflects selection made in other visuals | Pass - renders from the incoming dataView |
| Highlighting from another visual | **Fixed** - shows the highlighted figure, `supportsHighlight` |
| Edit interactions turned off | **Fixed** - guarded by `hostCapabilities.allowInteractions` |
| Ctrl / Alt / Shift selection | Pass - Ctrl and Cmd add to the selection |
| min/max dataViewMapping conditions | **Fixed** - conditions declared |
| Remove fields in arbitrary order; no console errors | Pass - guarded reads, landing page when empty |
| Format pane: every bucket configuration, bad input | **Fixed** - every declared property is reachable in the pane (see below); defaults on every property, out-of-range values clamped |
| Bad data: null, infinity, negative, wrong types | Pass - covered by unit tests |
| Data volumes: one row, two rows, thousands | Pass - data reduction declared |
| Number formats and precision changes | Pass - model format strings honoured |
| High contrast mode | **Fixed** - colours taken from the host palette |
| Keyboard navigation | **Fixed** - focusable, Enter/Space activates, `supportsKeyboardFocus` |
| Landing page when nothing is bound | **Fixed** - explains what to bind |
| Localization | **Fixed** - `stringResources` and the host localization manager |
| Bookmarks | Pass |
| Sample .pbix embeds the submitted visual version (1180.2.3) | **Fixed** - sample embeds 1.2.0.0, byte-identical to `dist/groupedIndicatorTable3BCEC6EDD44443449B5E9264E10CD122.1.2.0.0.pbiviz` |
| No external services; `privileges: []` | Pass - certification audit reports no external requests |

`pbiviz package --certification-audit` reports no external requests. It also lists 8
optional features - informational extras (Analytics Pane, Conditional Formatting, Drill
Down, Fetch More Data, File Download, Launch URL, Local Storage, Modal Dialog, Warning
Icon), several of which would require privileges that certification forbids.

## Format pane coverage (27 August 2026)

At API 5.x the Format pane is built solely from `getFormattingModel`. A property declared in
`capabilities.json` but not returned there is unreachable to the report author - it can only
be set by hand-editing a theme file - which fails the reviewer's "Format pane: every bucket
configuration" test and makes any listing claim about it false.

**10 properties were unreachable at 1.2.0.0:** `pillColor`, `pillBg`, `deltaColumnCount`, `hideEmptyColumns`, `sortByGroup`, `heatmap`, `heatmapCenter`, `heatmapLow`, `heatmapMid` and `heatmapHigh`. All are now in the pane.

**Newly added because nothing existed behind them:** a font family picker, a separate header font size, and colours for body text, value cells and group labels - each was previously
hardcoded in `style/visual.less`.

All 23 declared properties are now returned from `getFormattingModel`, and a unit test
asserts that, so it cannot regress silently.

## Current state (28 August 2026)

**Submitted 27 August 2026 at 1.2.0.0. Awaiting review outcome.**

**1.3.0.0 is built ahead on `main`, not submitted.** It pre-empts the resize finding the
reviewer raised against Accent KPI Card on 27 August 2026 (1180.2.2: overlay scrollbars on
WebView2 paint nothing, so a shrunken visual looks clipped) by styling the scrollbars so a
visible bar renders whenever content overflows, and adds a Wrap text toggle (Format pane >
Layout). The sample .pbix on `main` embeds 1.3.0.0. **The `certification` branch stays at
1.2.0.0 until this review completes** - it must match the package under review. If the
review fails 1180.2.2, resubmit 1.3.0.0 (both slots together) and push
`main:certification`; if it passes, 1.3.0.0 ships as a normal update later.

**What went up:** `dist/groupedIndicatorTable3BCEC6EDD44443449B5E9264E10CD122.1.2.0.0.pbiviz` and `store/grouped-indicator-table-sample.pbix`, uploaded together on the Technical
configuration page, with the reviewer notes from `store/listing.md` pasted into Notes for
certification on Review and publish.

**Sample file:** re-saved from Power BI Desktop on 27 August 2026. It embeds 1.2.0.0, matching
the submitted package - JS, CSS and capabilities byte-identical. The model is import-mode
with inline sample data, so it opens offline with no data sources, connectors or credentials.

**Verified at this version:** npm audit 0 vulnerabilities; ESLint clean; 31 tests passing
at 97% statement coverage; `pbiviz package --certification-audit` reports no external
requests. It also lists 8 optional features - the informational extras described above,
not failures.

**If this review raises anything,** fix it in a new version and upload both slots again.
Re-uploading one slot alone is what produced the 1180.2.3 failure on Pill Toggle Slicer.
