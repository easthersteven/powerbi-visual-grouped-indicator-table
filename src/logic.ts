// Pure, testable helpers for the Grouped Indicator Table visual (no DOM or Power BI dependencies).

export type PrimitiveValue = string | number | boolean | Date | null | undefined;

// Parse a raw cell value into a number for colour maths.
// Percent strings are scaled to a ratio so "125%" -> 1.25 (same scale as a raw 1.25).
export function toNum(v: PrimitiveValue): number | null {
    if (typeof v === "number") return isFinite(v) ? v : null;
    const s = String(v ?? "");
    if (s.trim() === "") return null;
    const hasPct = s.indexOf("%") >= 0;
    const n = parseFloat(s.replace(/[%,\s]/g, ""));
    if (!isFinite(n)) return null;
    return hasPct ? n / 100 : n;
}

// Format a numeric raw value using a Power BI-style format string (so 1.25 -> "125%").
// Strings pass through unchanged (a measure may already return formatted text).
export function fmtNum(raw: PrimitiveValue, fmt: string | undefined): string {
    if (typeof raw !== "number" || !isFinite(raw)) return String(raw ?? "");
    const f = fmt || "";
    if (f.indexOf("%") >= 0) {
        const dec = (f.split(".")[1] || "").replace(/[^0#]/g, "").length;
        return (raw * 100).toFixed(dec) + "%";
    }
    const dec = f.indexOf(".") >= 0 ? (f.split(".")[1] || "").replace(/[^0#]/g, "").length : 0;
    return raw.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function hex(h: string): number[] {
    const m = /^#?([0-9a-f]{6})$/i.exec((h || "").trim());
    return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : [255, 255, 255];
}

export function mix(a: number[], b: number[], t: number): string {
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}

// Should heatmap colouring be active?
//  - if the heatMode role is bound (a value is provided), colour only when the value reads
//    On / True / Yes / 1 (case-insensitive), so a measure can switch the heatmap per view
//  - if not bound (null), fall back to the static heatmap format property
export function heatActive(heatModeVal: string | null, heatmapProp: boolean): boolean {
    if (heatModeVal !== null && heatModeVal !== undefined) return /^(on|true|yes|1)$/i.test(heatModeVal.trim());
    return !!heatmapProp;
}

// Diverging cell colour around a centre. Returns background + readable text colour.
export function divergingColor(n: number, center: number, span: number, lo: number[], mid: number[], hi: number[]): { bg: string; fg: string } {
    const s = span === 0 ? 1 : span;
    const t = Math.max(-1, Math.min(1, (n - center) / s));
    const bg = t < 0 ? mix(mid, lo, -t) : mix(mid, hi, t);
    const fg = Math.abs(t) > 0.55 ? "#FFFFFF" : "#023864";
    return { bg, fg };
}

// Classify a delta cell by its leading arrow and the row's good direction ("up", "down", "neutral").
export function deltaClass(text: string, dir: string): "good" | "bad" | "neutral" {
    const d = (dir || "").toLowerCase();
    const sign = text.indexOf("▲") === 0 ? 1 : text.indexOf("▼") === 0 ? -1 : 0;
    if (d === "neutral" || d === "") return "neutral";
    if (d === "down") return sign < 0 ? "good" : sign > 0 ? "bad" : "neutral";
    return sign > 0 ? "good" : sign < 0 ? "bad" : "neutral";
}
