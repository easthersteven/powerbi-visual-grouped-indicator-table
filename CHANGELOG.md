# Changelog

## 1.2.0.0 (2026-08-27)

Makes every setting reachable from the Format pane, and adds the text controls the table was
missing.

- **Ten properties were unreachable.** `pillColor`, `pillBg`, `deltaColumnCount`,
  `hideEmptyColumns`, `sortByGroup`, `heatmap`, `heatmapCenter`, `heatmapLow`, `heatmapMid`
  and `heatmapHigh` were declared in `capabilities.json` but never returned from
  `getFormattingModel`. At API 5.x the pane is built solely from that model, so they could
  only be set by hand-editing a theme file. All are now in the pane, under new Layout and
  Heatmap cards.
- **Font family.** A font picker sets the typeface for the whole table; it was hardcoded to
  Segoe UI in the stylesheet.
- **Header font size** is separate from the body font size, which was the only text setting
  the pane offered.
- **Text colours.** Body text, value cells and group labels each take their own colour.
  Previously body text was fixed at `#252423` and value cells at `#023864`, with no property
  behind them.
- Numeric settings are range-checked, so an out-of-range value from a hand-edited theme file
  falls back to the default instead of rendering an unusable table.
- A test asserts that every property declared in `capabilities.json` appears in the Format
  pane, so this cannot regress silently.

## 1.1.0.0 (2026-08-26)

Audited against the Microsoft certification policies and the reviewer test list after the
Accent KPI Card review returned findings against the same policies.

- **Resizing (1180.2.2).** Scrolls instead of clipping when the host shrinks the visual.
- **Tooltips (1180.2.2.2).** Host tooltips on hover, and the `tooltips` capability declared.
- **Accessibility.** High contrast colours come from the host palette; interactive elements
  are keyboard reachable and activate with Enter or Space (`supportsKeyboardFocus`).
- **Interaction correctness.** Honours the report's Edit interactions setting.
- **Landing page.** Explains what to bind when no fields are present.
- **Localization.** String resources and the host localization manager.
- **dataViewMapping conditions** declared, so field buckets accept the intended cardinality.

## 1.0.0.0 (2026-08-13)

- Initial public release.
- Grouped rows with merged (row-spanned) shared cells and group-level cross-filtering.
- Direction-aware delta column colouring.
- Optional diverging heatmap with a static toggle or a bound switch field.
- Format pane controls for font size and all colours.
- Rendering Events API support and context menu support.
