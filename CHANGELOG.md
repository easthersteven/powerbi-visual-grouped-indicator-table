# Changelog

## 1.3.0.0 (2026-08-28)

Built on main while the 1.2.0.0 review is in flight; not yet submitted. Pre-empts the
resize finding raised against Accent KPI Card on 27 August 2026, which this visual shares
the mechanics of.

- **Visible scroll bars.** The root was already `overflow: auto`, but on hosts with overlay
  scrollbars (WebView2 with Windows' "automatically hide scroll bars" default - Power BI
  Desktop) the bar occupies no layout space and paints nothing until the user scrolls, so a
  shrunken table looked clipped with no scroll bars. The scrollbar is now explicitly styled
  (standard `scrollbar-width`/`scrollbar-color`, plus `::-webkit-scrollbar` for older
  WebView2 hosts), which opts out of overlay rendering: a thin bar with a visible track
  renders whenever content overflows, in both axes. Under high contrast the thumb and track
  follow the host palette.
- **Wrap text (Format pane > Layout).** Off by default (the table scrolls). Turned on,
  headers and cells break onto further lines instead of scrolling sideways; vertical
  scrolling still applies when the wrapped table is taller than the visual.
- **Scrollbar styling corrected.** The standard `scrollbar-width`/`scrollbar-color`
  properties override `::-webkit-scrollbar` on Chromium and merely restyle the invisible
  overlay bar there, so they are now served to Firefox only
  (`@supports (-moz-appearance: none)`); the `::-webkit-scrollbar` rules force the real
  painted bar on Chromium/WebView2. Pinned by a unit test.
- **`supportsHighlight` removed.** The visual uses a table data mapping, which cannot
  receive highlights, so the declaration (and the listing's claim) were wrong. Cross-
  filtering into the table still works - the host filters the rows it sends.
- **High contrast: no more white-on-white.** Even-numbered groups had a hard-coded white
  background under every theme, which put the host's foreground text on white in a
  black-background high-contrast theme. Every row now takes the host background, and the
  tinted hover/selection backgrounds are suppressed (selection stays visible through the
  inset accent bar and dimming).
- **Edit interactions fully honoured.** Clicking empty space no longer clears the
  selection when the report author has turned this visual's interactions off.
- **Touch tooltips.** A tap on a row shows the same tooltip as hovering - mousemove never
  fires on touch devices.

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
