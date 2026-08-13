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
        createSelectionIdBuilder: () => ({ withTable: () => ({ createSelectionId: () => ({}) }) })
    };
}

function makeVisual() {
    const captured = { events: [], selections: [], cleared: 0, contextMenus: 0 };
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

test("getFormattingModel exposes text and colour cards", () => {
    const { visual } = makeVisual();
    assert.equal(visual.getFormattingModel().cards.length, 2);
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
