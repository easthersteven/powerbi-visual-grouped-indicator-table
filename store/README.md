# Store assets - Grouped Indicator Table

| File | Used for |
| --- | --- |
| `listing.md` | Paste-ready Partner Center values for every page of the offer |
| `icon-300x300.png` | Offer listing logo (exactly 300x300) |
| `screenshot-1366x768.png` | Offer listing screenshot (exactly 1366x768, under 1024 kb) |
| `grouped-indicator-table-sample.pbip` | Power BI Project that produces the required sample report |

## Producing the sample .pbix

Partner Center requires a sample report that opens **offline**. The project here holds the
whole report as text: an offline semantic model (data embedded with Power Query's
"Enter data" pattern) and a two-page report - an Overview page showing the visual and a
Tips page. Turn it into a .pbix once:

1. Power BI Desktop > **File > Options and settings > Options > Preview features** and
   tick **Store reports using enhanced metadata format (PBIR)**. Restart Desktop.
2. Open `store/grouped-indicator-table-sample.pbip`.
3. **Insert > More visuals > Import a visual from a file** and pick
   `dist/groupedIndicatorTable3BCEC6EDD44443449B5E9264E10CD122.1.0.0.0.pbiviz`. If the visual container is still
   blank, close and reopen the project - Desktop registers the visual on load.
4. **Ctrl+S** to save the project (this writes the visual into the report definition).
5. **File > Save as** > `store/grouped-indicator-table-sample.pbix`.

Keep the .pbix in step with the visual version you upload: rebuild with
`npm run package`, re-import the new .pbiviz, and save again.

> **Regenerating the project:** close it in Power BI Desktop first. Regeneration replaces the
> `definition/` folder wholesale, and Desktop holds its own copy in memory - if it saves over a
> regenerated project you get a mix of old and new visuals, and the stale ones report
> `Missing_References` against fields the model no longer has.
