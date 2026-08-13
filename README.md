# Grouped Indicator Table

A Power BI custom visual: a table that groups rows, merges the cells the group shares into single spanned cells, colour-codes delta columns according to each row's good direction, optionally applies a diverging heatmap to numeric cells, and cross-filters the rest of the page when a row is selected.

## Features

- Group rows by a key column; clicking any row in a group selects the whole group and cross-filters the page (Ctrl or Cmd click for multi-select, click the background or the selected row again to clear).
- Merge mode: when a text measure is bound (for example a shared name or source), the shared value columns collapse into one centred cell spanning all rows of the group. Rows whose merge value is empty ("-") are dropped.
- Delta columns: the trailing N value columns (configurable) are treated as deltas. A leading ▲ or ▼ arrow is coloured good or bad according to the row's good direction ("up", "down", or "neutral") from the optional direction field.
- Numeric formatting from the model's format strings (percent and grouped numbers).
- Optional diverging heatmap on numeric value cells around a configurable centre, either switched statically in the Format pane or driven per-view by an optional "Heatmap switch" field (active when its value reads On, True, Yes, or 1).
- Short group codes (such as "C57") render as pills.
- Optional hide-empty-columns mode: value columns that are entirely empty collapse away, useful when a slicer blanks other groups' measures.
- Format pane controls for font size, header colours, alternating row colour, accent, and good/bad/neutral colours.
- Sticky header row and scrolling body.
- Rendering Events API support and context menu support (right-click).

## Data roles

| Role | Kind | Description |
| --- | --- | --- |
| Group by (merged) | Grouping | The key that defines row groups. |
| Row columns | Grouping | Detail columns shown per row. |
| Values (merged) | Measure | Value columns. Text measures become merge columns, trailing columns become deltas. |
| Delta direction (hidden) | Grouping | Optional "up" / "down" / "neutral" good direction per row. Not displayed. |
| Heatmap switch (optional) | Grouping | Optional switch value; the heatmap activates when it reads On, True, Yes, or 1. |

## Format options

| Card | Option | Description |
| --- | --- | --- |
| Text | Font size | Table font size in pixels. |
| Colours | Header background / Header text | Header row styling. |
| Colours | Alternating row | Background of every second group. |
| Colours | Accent | Selection accent bar colour. |
| Colours | Up / good, Down / bad, Neutral | Delta colours. |

Additional properties available to report themes: pill colours, delta column count, hide empty columns, sort by group, and the heatmap (on/off, centre, low/mid/high colours).

## Building from source

Prerequisites: Node.js 18 or later and npm.

```
npm install
npm run package
```

The packaged visual is written to `dist/*.pbiviz` and can be imported into Power BI Desktop or the Power BI service.

For development with live reload:

```
npm start
```

## Tests

Unit tests run on the Node.js test runner with jsdom and enforce a minimum statement coverage threshold:

```
npm test
```

## Linting

```
npm run lint
```

Linting uses eslint with eslint-plugin-powerbi-visuals.

## Repository layout

- `src/visual.ts` - the visual class (DOM rendering, selection, formatting model).
- `src/logic.ts` - pure helper functions (number parsing and formatting, colour maths, heatmap gating, delta classification).
- `capabilities.json` - data roles, data view mappings, and format objects. Privileges are empty; the visual makes no external calls.
- `test/` - unit tests.

The `certification` branch contains the source matching the package submitted for Power BI certification.

## Support

Please report issues at https://github.com/easthersteven/powerbi-visual-grouped-indicator-table/issues

## License

MIT, see LICENSE.
