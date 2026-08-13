import { test } from "node:test";
import assert from "node:assert/strict";
import { toNum, fmtNum, hex, mix, heatActive, divergingColor, deltaClass } from "../.tmp/test-build/logic.js";

function approx(actual, expected, message) {
    assert.ok(actual !== null && Math.abs(actual - expected) < 1e-9, `${message}: got ${actual}, expected ~${expected}`);
}

// --- toNum: percent strings scale to a ratio so colour maths share one centre (1.0) ---
test("toNum parses numbers, percents, and grouped strings", () => {
    approx(toNum(1.25), 1.25, "number passes through");
    approx(toNum("125%"), 1.25, "'125%' -> 1.25");
    approx(toNum("78%"), 0.78, "'78%' -> 0.78");
    approx(toNum("1,250"), 1250, "'1,250' -> 1250");
    approx(toNum("42"), 42, "'42' -> 42");
});

test("toNum returns null for empty and non-numeric values", () => {
    assert.equal(toNum(""), null);
    assert.equal(toNum("-"), null);
    assert.equal(toNum(null), null);
});

// --- fmtNum: format strings from the data model drive the display text ---
test("fmtNum applies percent and grouped formats", () => {
    assert.equal(fmtNum(1.25, "0%"), "125%");
    assert.equal(fmtNum(0.786, "0.0%"), "78.6%");
    assert.equal(fmtNum(1234.5, "#,0"), "1,235");
});

test("fmtNum passes strings through unchanged", () => {
    assert.equal(fmtNum("125%", "0%"), "125%");
    assert.equal(fmtNum("-", undefined), "-");
});

// --- hex / mix ---
test("hex parses six-digit colours with or without a hash", () => {
    assert.deepEqual(hex("#FFFFFF"), [255, 255, 255]);
    assert.deepEqual(hex("2C7FB8"), [44, 127, 184]);
    assert.deepEqual(hex("not-a-colour"), [255, 255, 255]);
});

test("mix interpolates channel-wise", () => {
    assert.equal(mix([0, 0, 0], [255, 255, 255], 0.5), "rgb(128,128,128)");
    assert.equal(mix([255, 255, 255], [255, 255, 255], 0.5), "rgb(255,255,255)");
});

// --- heatActive: the mode gate ---
test("heatActive follows the bound switch value when the role is bound", () => {
    assert.equal(heatActive("On", false), true);
    assert.equal(heatActive("TRUE", false), true);
    assert.equal(heatActive("yes", false), true);
    assert.equal(heatActive("1", false), true);
    assert.equal(heatActive("Off", true), false);
    assert.equal(heatActive("anything else", true), false);
});

test("heatActive falls back to the static property when the role is not bound", () => {
    assert.equal(heatActive(null, true), true);
    assert.equal(heatActive(null, false), false);
});

// --- divergingColor: low colour under centre, mid at centre, high colour over ---
test("divergingColor picks the correct side of the centre", () => {
    const lo = hex("#2C7FB8"), mid = hex("#FFFFFF"), hi = hex("#E8843C");
    assert.equal(divergingColor(1, 1, 1, lo, mid, hi).bg, "rgb(255,255,255)");
    assert.equal(divergingColor(2, 1, 1, lo, mid, hi).bg, "rgb(232,132,60)");
    assert.equal(divergingColor(0, 1, 1, lo, mid, hi).bg, "rgb(44,127,184)");
});

test("divergingColor keeps text readable on strong cells", () => {
    const lo = hex("#2C7FB8"), mid = hex("#FFFFFF"), hi = hex("#E8843C");
    assert.equal(divergingColor(2, 1, 1, lo, mid, hi).fg, "#FFFFFF");
    assert.equal(divergingColor(1.1, 1, 1, lo, mid, hi).fg, "#023864");
});

// --- deltaClass: arrow direction vs the metric's good direction ---
test("deltaClass classifies against the good direction", () => {
    assert.equal(deltaClass("▲ 2pp", "up"), "good");
    assert.equal(deltaClass("▼ 2pp", "up"), "bad");
    assert.equal(deltaClass("▲ 2pp", "down"), "bad");
    assert.equal(deltaClass("▼ 2pp", "down"), "good");
    assert.equal(deltaClass("▲ 2pp", "neutral"), "neutral");
    assert.equal(deltaClass("▲ 2pp", ""), "neutral");
    assert.equal(deltaClass("0pp", "up"), "neutral");
});

// --- integration: mirror how update() decides each value cell, for both switch states ---
test("bound switch colours cells only when it reads On", () => {
    const lo = hex("#2C7FB8"), mid = hex("#FFFFFF"), hi = hex("#E8843C");
    const render = (values, heatModeVal, heatmapProp) => {
        const on = heatActive(heatModeVal, heatmapProp);
        let span = 0;
        if (on) for (const v of values) { const n = toNum(v); if (n !== null) span = Math.max(span, Math.abs(n - 1)); }
        if (span === 0) span = 1;
        return values.map((v) => {
            const n = on ? toNum(v) : null;
            return { text: fmtNum(v, "0%"), bg: n === null ? null : divergingColor(n, 1, span, lo, mid, hi).bg };
        });
    };
    const on = render(["125%", "80%", "100%"], "On", false);
    assert.equal(on[0].text, "125%");
    const over = on[0].bg.match(/\d+/g).map(Number), under = on[1].bg.match(/\d+/g).map(Number);
    assert.ok(over[0] > over[2], "over-centre cell leans to the high colour (R > B)");
    assert.ok(under[2] > under[0], "under-centre cell leans to the low colour (B > R)");
    assert.equal(on[2].bg, "rgb(255,255,255)");

    const off = render(["42", "310", "6"], "Off", false);
    assert.ok(off.every((c) => c.bg === null), "switch Off applies no background");
    assert.equal(off[1].text, "310");
});
