import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;

const { Visual } = await import("../.tmp/test-build/visual.js");

function makeHost(captured) {
    return {
        eventService: {
            renderingStarted: () => captured.events.push("started"),
            renderingFinished: () => captured.events.push("finished"),
            renderingFailed: (_o, e) => captured.events.push("failed:" + e)
        },
        createSelectionManager: () => ({
            showContextMenu: () => { captured.contextMenus++; },
            clear: () => { captured.cleared++; return Promise.resolve(); },
            select: (ids, multi) => { captured.selections.push({ count: ids.length, multi }); return Promise.resolve(); }
        }),
        createSelectionIdBuilder: () => ({ withTable: () => ({ createSelectionId: () => ({}) }) }),
        tooltipService: {
            show: (o) => { captured.tooltips.push(o); },
            hide: () => { captured.tooltipHides++; }
        },
        colorPalette: captured.palette,
        get hostCapabilities() { return captured.hostCapabilities; }
    };
}

function makeVisual() {
    const captured = { events: [], selections: [], cleared: 0, contextMenus: 0, tooltips: [], tooltipHides: 0, palette: { isHighContrast: false, foreground: { value: '#ffffff' }, background: { value: '#000000' } } };
    const element = document.createElement("div");
    document.body.appendChild(element);
    const visual = new Visual({ host: makeHost(captured), element });
    return { visual, element, captured };
}

function col(displayName, queryName, roles, extra = {}) {
    return { displayName, queryName, roles, ...extra };
}

function update(visual, columns, rows, objects) {
    visual.update({
        viewport: { width: 800, height: 600 },
        dataViews: [{ metadata: { objects }, table: { columns, rows } }]
    });
}

const flush = () => new Promise((r) => setTimeout(r, 0));

// standard sample used by the certification test cases below
function sampleColumns() {
    return [
        col("Code", "T.Code", { groupBy: true }),
        col("Name", "T.Name", { dimensions: true }),
        col("Now", "_Measures.Now", { values: true }, { isMeasure: true, format: "0%" }),
        col("Change", "_Measures.Change", { values: true }, { isMeasure: true }),
        col("Dir", "T.GoodDirection", { direction: true })
    ];
}
const sampleRows = () => [["C1", "Alpha", 0.5, "▲ 2pp", "up"], ["C2", "Beta", 0.6, "▼ 1pp", "up"]];


test("renders a header and one row per table row, direction column hidden", () => {
    const { visual, element, captured } = makeVisual();
    const columns = [
        col("Code", "T.Code", { groupBy: true }),
        col("Name", "T.Name", { dimensions: true }),
        col("Now", "_Measures.Now", { values: true }, { isMeasure: true, format: "0%" }),
        col("Change", "_Measures.Change", { values: true }, { isMeasure: true }),
        col("Dir", "T.GoodDirection", { direction: true })
    ];
    const rows = [
        ["C1", "Alpha", 0.5, "▲ 2pp", "up"],
        ["C2", "Beta", 0.6, "▼ 1pp", "up"]
    ];
    update(visual, columns, rows);
    assert.equal(element.querySelectorAll("thead th").length, 4);
    assert.equal(element.querySelectorAll("tbody tr").length, 2);
    assert.deepEqual(captured.events, ["started", "finished"]);
});

test("formats numeric value cells with the column format string", () => {
    const { visual, element } = makeVisual();
    const columns = [
        col("Code", "T.Code", { groupBy: true }),
        col("Now", "_Measures.Now", { values: true }, { isMeasure: true, format: "0%" }),
        col("Change", "_Measures.Change", { values: true }, { isMeasure: true })
    ];
    update(visual, columns, [["C1", 0.5, "▲ 2pp"]]);
    const cells = [...element.querySelectorAll("tbody td")].map((td) => td.textContent);
    assert.ok(cells.includes("50%"), `expected a "50%" cell, got ${JSON.stringify(cells)}`);
});

test("colours the trailing delta column by the good direction", () => {
    const { visual, element } = makeVisual();
    const columns = [
        col("Code", "T.Code", { groupBy: true }),
        col("Now", "_Measures.Now", { values: true }, { isMeasure: true, format: "0%" }),
        col("Change", "_Measures.Change", { values: true }, { isMeasure: true }),
        col("Dir", "T.GoodDirection", { direction: true })
    ];
    update(visual, columns, [["C1", 0.5, "▲ 2pp", "up"], ["C2", 0.4, "▼ 1pp", "up"]]);
    const deltas = [...element.querySelectorAll("tbody td")].filter((td) => td.style.fontWeight === "700" && td.classList.contains("num"));
    assert.equal(deltas.length, 2);
    assert.equal(deltas[0].style.color, "rgb(15, 122, 44)");  // good (default #0F7A2C)
    assert.equal(deltas[1].style.color, "rgb(158, 47, 36)");  // bad (default #9E2F24)
});

test("renders short group codes as pills", () => {
    const { visual, element } = makeVisual();
    const columns = [
        col("Code", "T.Code", { groupBy: true }),
        col("Now", "_Measures.Now", { values: true }, { isMeasure: true })
    ];
    update(visual, columns, [["C57", 5]]);
    assert.equal(element.querySelectorAll("span.gi-pill").length, 1);
});

test("ordinary text is never pilled and follows the body text colour", () => {
    const { visual, element } = makeVisual();
    const columns = [
        col("Region", "T.Region", { dimensions: true }),
        col("Now", "_Measures.Now", { values: true }, { isMeasure: true })
    ];
    const objects = { tableStyle: { textColor: { solid: { color: "#112233" } } } };
    update(visual, columns, [["North", 5], ["South", 6]], objects);
    assert.equal(element.querySelectorAll("span.gi-pill").length, 0, "a region name is not a code pill");
    const cell = [...element.querySelectorAll("tbody td")].find((td) => td.textContent === "North");
    assert.equal(cell.style.color, "", "the cell inherits the root's Body text colour");
    assert.equal(element.style.color, "rgb(17, 34, 51)");
});

test("a code-like dim column still gets pills when the group column is ordinary text", () => {
    const { visual, element } = makeVisual();
    const columns = [
        col("Team", "T.Team", { groupBy: true }),
        col("Code", "T.Code", { dimensions: true }),
        col("Now", "_Measures.Now", { values: true }, { isMeasure: true })
    ];
    update(visual, columns, [["Alpha team", "C57", 5]]);
    const pills = [...element.querySelectorAll("span.gi-pill")];
    assert.equal(pills.length, 1);
    assert.equal(pills[0].textContent, "C57");
});

test("merge mode spans shared value cells across the group's rows", () => {
    const { visual, element } = makeVisual();
    const columns = [
        col("Code", "T.Code", { groupBy: true }),
        col("Item", "T.Item", { dimensions: true }),
        col("Indicator", "_Measures.Indicator", { values: true }, { isMeasure: true }),
        col("Now", "_Measures.Now", { values: true }, { isMeasure: true, format: "0%" }),
        col("Change", "_Measures.Change", { values: true }, { isMeasure: true })
    ];
    const rows = [
        ["C1", "First item", "Fatigue", 0.5, "▲ 2pp"],
        ["C1", "Second item", "Fatigue", 0.5, "▲ 2pp"]
    ];
    update(visual, columns, rows);
    const bodyRows = element.querySelectorAll("tbody tr");
    assert.equal(bodyRows.length, 2);
    const merged = element.querySelectorAll("td.merged");
    assert.equal(merged.length, 3);
    assert.equal(merged[0].rowSpan, 2);
    assert.equal(bodyRows[1].querySelectorAll("td").length, 2);
});

test("bound heatmap switch set to On colours numeric value cells", () => {
    const { visual, element } = makeVisual();
    const columns = [
        col("Code", "T.Code", { groupBy: true }),
        col("Ratio", "_Measures.Ratio", { values: true }, { isMeasure: true, format: "0%" }),
        col("Heat", "T.Heat", { heatMode: true })
    ];
    update(visual, columns, [["C1", 1.5, "On"], ["C2", 0.5, "On"]], { tableStyle: { deltaColumnCount: 0 } });
    const nums = [...element.querySelectorAll("tbody td.num")];
    assert.equal(nums.length, 2);
    assert.ok(nums.every((td) => td.style.background !== ""), "heatmap backgrounds applied");
});

test("clicking a row selects its group and dims the rest", async () => {
    const { visual, element, captured } = makeVisual();
    const columns = [
        col("Code", "T.Code", { groupBy: true }),
        col("Now", "_Measures.Now", { values: true }, { isMeasure: true })
    ];
    update(visual, columns, [["C1", 5], ["C2", 6]]);
    const rows = element.querySelectorAll("tbody tr");
    rows[0].dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await flush();
    assert.equal(captured.selections.length, 1);
    assert.equal(captured.selections[0].multi, false);
    assert.equal(rows[0].classList.contains("sel"), true);
    assert.equal(rows[1].style.opacity, "0.5");
});

test("finishes rendering without content when there is no data", () => {
    const { visual, element, captured } = makeVisual();
    visual.update({ viewport: { width: 100, height: 100 }, dataViews: [] });
    assert.equal(element.querySelector("table"), null);
    assert.deepEqual(captured.events, ["started", "finished"]);
});

test("getFormattingModel exposes text, colour, layout and heatmap cards", () => {
    const { visual } = makeVisual();
    const names = visual.getFormattingModel().cards.map((c) => c.displayName);
    assert.deepEqual(names, ["Text", "Colours", "Layout", "Heatmap"]);
});

test("right-click on a row opens the context menu", () => {
    const { visual, element, captured } = makeVisual();
    const columns = [
        col("Code", "T.Code", { groupBy: true }),
        col("Now", "_Measures.Now", { values: true }, { isMeasure: true })
    ];
    update(visual, columns, [["C1", 5]]);
    element.querySelector("tbody tr").dispatchEvent(new dom.window.MouseEvent("contextmenu", { bubbles: true }));
    assert.equal(captured.contextMenus, 1);
});

// ---- certification policy 1180.2.2.x -------------------------------------------------

test("scroll bars render even on overlay-scrollbar hosts (1180.2.2)", async () => {
    const { readFileSync } = await import("node:fs");
    const raw = readFileSync(new URL("../style/visual.less", import.meta.url), "utf8");
    const less = raw.replace(/\/\/[^\n]*/g, "");  // comments also mention the property names
    assert.match(less, /::-webkit-scrollbar\b/, "webkit rules force a painted classic scrollbar on Chromium/WebView2");
    const guard = less.indexOf("@supports (-moz-appearance: none)");
    const std = less.indexOf("scrollbar-width");
    assert.ok(guard >= 0, "the Firefox-only @supports guard must exist");
    assert.ok(std > guard, "standard scrollbar properties must sit inside the Firefox guard - on Chromium they restyle the invisible overlay scrollbar and defeat the webkit rules");
    assert.equal(less.split("scrollbar-width").length, 2, "scrollbar-width must appear exactly once, inside the guard");
});

test("high contrast: every row takes the host background, never hard-coded white", () => {
    const { visual, element, captured } = makeVisual();
    captured.palette.isHighContrast = true;
    update(visual, sampleColumns(), sampleRows());
    const rows = [...element.querySelectorAll("tbody tr")];
    assert.ok(rows.length >= 2);
    for (const tr of rows) assert.equal(tr.style.background, "rgb(0, 0, 0)", "foreground-coloured text must never sit on hard-coded white");
    assert.equal(element.classList.contains("hc"), true, "the hc class suppresses the tinted hover/selection backgrounds");
});

test("clicking empty space does not clear the selection when interactions are off", async () => {
    const { visual, element, captured } = makeVisual();
    captured.hostCapabilities = { allowInteractions: false };
    update(visual, sampleColumns(), sampleRows());
    element.dispatchEvent(new dom.window.MouseEvent("click"));
    await flush();
    assert.equal(captured.cleared, 0, "Edit interactions off must also cover the clear gesture");
});

test("scrolls rather than clipping when the host shrinks the visual (1180.2.2)", async () => {
    const { readFileSync } = await import("node:fs");
    const less = readFileSync(new URL("../style/visual.less", import.meta.url), "utf8");
    assert.match(less.slice(0, 400), /overflow:\s*auto/, "the root container must scroll, not clip");
});

test("shows a row tooltip listing every displayed column (1180.2.2.2)", () => {
    const { visual, element, captured } = makeVisual();
    update(visual, sampleColumns(), sampleRows());
    const row = element.querySelector("tbody tr");
    row.dispatchEvent(new dom.window.MouseEvent("mousemove", { clientX: 4, clientY: 4, bubbles: true }));
    assert.equal(captured.tooltips.length, 1);
    assert.ok(captured.tooltips[0].dataItems.length > 0, "tooltip lists the row's columns");
    row.dispatchEvent(new dom.window.MouseEvent("mouseleave", { bubbles: true }));
    assert.ok(captured.tooltipHides > 0);
});

test("keyboard: rows are focusable and Enter selects the group (1180.2.2.3)", () => {
    const { visual, element, captured } = makeVisual();
    update(visual, sampleColumns(), sampleRows());
    const row = element.querySelector("tbody tr");
    assert.equal(row.tabIndex, 0);
    row.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    assert.equal(captured.selections.length, 1);
});

test("respects Edit interactions being turned off", () => {
    const { visual, element, captured } = makeVisual();
    captured.hostCapabilities = { allowInteractions: false };
    update(visual, sampleColumns(), sampleRows());
    element.querySelector("tbody tr").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.equal(captured.selections.length, 0);
});

test("high contrast: colours come from the host palette", () => {
    const { visual, element, captured } = makeVisual();
    captured.palette.isHighContrast = true;
    update(visual, sampleColumns(), sampleRows());
    assert.equal(element.querySelector("th").style.background, "rgb(0, 0, 0)");
    assert.equal(element.querySelector("th").style.color, "rgb(255, 255, 255)");
});

test("landing page explains the visual when no fields are bound", () => {
    const { visual, element } = makeVisual();
    visual.update({ dataViews: [{ metadata: {}, table: { columns: [], rows: [] } }] });
    assert.ok(element.querySelector(".gi-landing-title"));
});

// ---- Format pane coverage ------------------------------------------------------------

// Collect every propertyName the Format pane actually renders, walking cards > groups > slices.
function paneProperties(model) {
    const names = new Set();
    for (const card of model.cards ?? []) {
        for (const group of card.groups ?? []) {
            for (const slice of group.slices ?? []) {
                const props = slice.control?.properties ?? {};
                if (props.descriptor?.propertyName) names.add(props.descriptor.propertyName);
                for (const v of Object.values(props)) {
                    if (v && typeof v === "object" && v.descriptor?.propertyName) names.add(v.descriptor.propertyName);
                }
            }
        }
    }
    return names;
}

// At API 5.x the Format pane is built solely from getFormattingModel, so a property declared
// in capabilities.json but missing here is unreachable to the report author - it can only be
// set by hand-editing a theme file. This guards against that drifting back.
test("every declared property is reachable in the Format pane", async () => {
    const { readFileSync } = await import("node:fs");
    const caps = JSON.parse(readFileSync(new URL("../capabilities.json", import.meta.url), "utf8"));
    const declared = Object.keys(caps.objects.tableStyle.properties);
    const { visual } = makeVisual();
    const shown = paneProperties(visual.getFormattingModel());
    const missing = declared.filter((p) => !shown.has(p));
    assert.deepEqual(missing, [], "properties declared but not shown in the Format pane");
});

test("the table renders the configured font, sizes and text colours", () => {
    const { visual, element } = makeVisual();
    const objects = {
        tableStyle: {
            fontFamily: "Georgia, serif",
            fontSize: 17,
            headerSize: 22,
            textColor: { solid: { color: "#112233" } },
            valueColor: { solid: { color: "#445566" } },
            groupColor: { solid: { color: "#778899" } }
        }
    };
    // a text value column puts the table in merge mode, so a merged group cell is rendered
    const columns = [
        col("Code", "T.Code", { groupBy: true }),
        col("Name", "T.Name", { dimensions: true }),
        col("Status", "_Measures.Status", { values: true }, { isMeasure: true }),
        col("Now", "_Measures.Now", { values: true }, { isMeasure: true, format: "0%" }),
        col("Change", "_Measures.Change", { values: true }, { isMeasure: true }),
        col("Dir", "T.GoodDirection", { direction: true })
    ];
    // a plain group name (not a short code) renders as a group key cell rather than a pill
    const rows = [["North", "Alpha", "Open", 0.5, "▲ 2pp", "up"], ["North", "Beta", "Open", 0.6, "▼ 1pp", "up"]];
    update(visual, columns, rows, objects);
    assert.equal(element.style.fontFamily, "Georgia, serif");
    assert.equal(element.style.color, "rgb(17, 34, 51)");
    assert.equal(element.querySelector("table.gi-table").style.fontSize, "17px");
    assert.equal(element.querySelector("th").style.fontSize, "22px");
    assert.equal(element.querySelector("td.grp-key").style.color, "rgb(119, 136, 153)");
    assert.equal(element.querySelector("td.merged").style.color, "rgb(68, 85, 102)");
});

test("out-of-range numbers from a hand-edited theme fall back to the defaults", () => {
    const { visual, element } = makeVisual();
    const objects = { tableStyle: { fontSize: -3, headerSize: 9999, deltaColumnCount: 999 } };
    update(visual, sampleColumns(), sampleRows(), objects);
    assert.equal(element.querySelector("table.gi-table").style.fontSize, "12px");
    assert.equal(element.querySelector("th").style.fontSize, "10px");
});
