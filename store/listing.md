# Partner Center listing - Grouped Indicator Table

Paste-ready values for the AppSource offer. Field limits are shown in brackets.

**Offer ID** (lowercase, no spaces): `grouped-indicator-table`

**Name** (50 chars max): Grouped Indicator Table

**Summary** (100 chars max, one sentence):
Table that groups rows under merged cells, colour codes values and filters other visuals on click.

**Description** (3,000 chars max, rich text allowed):

Grouped Indicator Table presents indicator style data the way people actually read it: rows collected into groups, shared cells merged into a single label, and values coloured so the exceptions stand out.

Key features:

- **Grouping with merged cells.** Rows that share a group value are drawn as one block with the group label merged down the left, so the table reads like a structured register rather than a flat grid.
- **Row selection that drives the report.** Clicking a row cross filters the other visuals on the page, which makes the table a natural navigation hub. Ctrl click supports multi select and clicking empty space clears the selection.
- **Colour coded values.** Delta columns are coloured good, bad or neutral, and code style values render as compact monospace pills. An optional heatmap shades numeric cells around a configurable centre point.
- **Full Format pane styling.** Font family, body and header font sizes, and colours for body text, value cells and group labels. Header colours, accent colour, alternating row shading, code pill colours, the heatmap and its three colours, and the layout switches for delta columns, empty columns and group sorting. Every setting the visual has is in the Format pane.
- **Certified friendly.** No external services, no data leaves your report, and the visual supports the Rendering Events API and context menus.

Works well for KPI registers, programme scorecards, control and compliance registers, and any dataset where rows belong to a small number of named groups.

**Search keywords** (up to 3): grouped table, indicator, scorecard

**Help link:** https://github.com/easthersteven/powerbi-visual-grouped-indicator-table#readme
**Privacy policy link:** https://github.com/easthersteven/powerbi-visual-grouped-indicator-table/blob/main/PRIVACY.md
**Support document link:** https://github.com/easthersteven/powerbi-visual-grouped-indicator-table/blob/main/SUPPORT.md
**Support (issues) link:** https://github.com/easthersteven/powerbi-visual-grouped-indicator-table/issues

**Media:**
- Logo 300x300: `store/icon-300x300.png`
- Screenshot 1366x768 (PNG, under 1024 kb): `store/screenshot-1366x768.png`
  Suggested caption: "Grouped rows with merged cells, colour coded deltas and clickable rows that filter the report."

**Properties page:**
- Category (max 2): Comparison + KPI
- Industry (max 2): leave empty - the visual is not industry-specific
- EULA: use the Standard Contract for Microsoft's commercial marketplace
- Privacy policy link: https://github.com/easthersteven/powerbi-visual-grouped-indicator-table/blob/main/PRIVACY.md
- Support document link: https://github.com/easthersteven/powerbi-visual-grouped-indicator-table/blob/main/SUPPORT.md

**Technical configuration page:**
- PBIVIZ package: `dist/groupedIndicatorTable3BCEC6EDD44443449B5E9264E10CD122.1.2.0.0.pbiviz`
  (full path: `C:\Users\se518\powerbi-visuals\powerbi-visual-grouped-indicator-table\dist\groupedIndicatorTable3BCEC6EDD44443449B5E9264E10CD122.1.2.0.0.pbiviz`)
- Sample PBIX: `store/grouped-indicator-table-sample.pbix` - must open offline with no external
  connections, embed its own sample data, and use this exact visual version.

**Certification:**
1. Offer setup page: tick **Request Power BI certification**.
2. Review and publish page, **Notes for certification** box, paste:

   Source code: https://github.com/easthersteven/powerbi-visual-grouped-indicator-table
   Branch: certification (matches the submitted package exactly)
   Access: public repository, no credentials required.
   Build: npm install, then npm run package (powerbi-visuals-tools 7.2.1, API 5.11.0).
   Verified: npm audit clean, eslint clean, `pbiviz package --certification-audit`
   reports no external requests, capabilities declare `"privileges": []`.

**Pre-publish checks (27 Aug 2026, v1.2.0.0):** npm audit 0 vulnerabilities; eslint
clean; unit tests pass; certification audit found no external requests; logo 300x300 and
screenshot 1366x768 within size limits; main and certification branches identical.
