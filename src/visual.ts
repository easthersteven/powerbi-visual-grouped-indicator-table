"use strict";

import powerbi from "powerbi-visuals-api";
import "./../style/visual.less";
import { toNum, fmtNum, hex, heatActive, divergingColor, deltaClass } from "./logic";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ITooltipService = powerbi.extensibility.ITooltipService;
import ISandboxExtendedColorPalette = powerbi.extensibility.ISandboxExtendedColorPalette;
import ILocalizationManager = powerbi.extensibility.ILocalizationManager;
import DataView = powerbi.DataView;
import DataViewTable = powerbi.DataViewTable;
import PrimitiveValue = powerbi.PrimitiveValue;

interface Style {
    headerBg: string; headerColor: string; rowAltBg: string; accent: string;
    pillColor: string; pillBg: string; good: string; bad: string; neutral: string;
    fontFamily: string; fontSize: number; headerSize: number;
    textColor: string; valueColor: string; groupColor: string;
    deltaColumnCount: number; hideEmptyColumns: boolean; sortByGroup: boolean; wrapText: boolean;
    heatmap: boolean; heatmapCenter: number; heatmapLow: string; heatmapMid: string; heatmapHigh: string;
}
const DEFAULTS: Style = {
    headerBg: "#023864", headerColor: "#FFFFFF", rowAltBg: "#f6faf9", accent: "#1F908C",
    pillColor: "#016C8D", pillBg: "#e7f1f4", good: "#0F7A2C", bad: "#9E2F24", neutral: "#605E5C",
    fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: 12, headerSize: 10,
    textColor: "#252423", valueColor: "#023864", groupColor: "#023864",
    deltaColumnCount: 1, hideEmptyColumns: false, sortByGroup: false, wrapText: false,
    heatmap: false, heatmapCenter: 1, heatmapLow: "#2C7FB8", heatmapMid: "#FFFFFF", heatmapHigh: "#E8843C",
};

function el(tag: string, cls?: string): HTMLElement { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function readObjects(dv: DataView): Record<string, unknown> | undefined {
    const raw = dv.metadata?.objects?.["tableStyle"] as unknown;
    return Array.isArray(raw) ? (raw[0] as Record<string, unknown>) : (raw as Record<string, unknown>);
}
function fill(o: Record<string, unknown> | undefined, k: string, d: string): string {
    return (o?.[k] as { solid?: { color?: string } })?.solid?.color || d;
}
// Numeric pane values are clamped: a hand-edited theme file can supply anything, and an
// out-of-range size or column count would render an unusable table.
function num(o: Record<string, unknown> | undefined, k: string, d: number, min: number, max: number): number {
    const n = o?.[k];
    if (typeof n !== "number" || !isFinite(n) || n < min || n > max) return d;
    return n;
}
function text(o: Record<string, unknown> | undefined, k: string, d: string): string {
    const t = o?.[k];
    return typeof t === "string" && t !== "" ? t : d;
}
const hasAlpha = (v: PrimitiveValue | undefined) => /[A-Za-z]/.test(String(v ?? ""));

export class Visual implements IVisual {
    private host: IVisualHost;
    private events: IVisualEventService;
    private selectionManager: ISelectionManager;
    private tooltipService: ITooltipService;
    private colorPalette: ISandboxExtendedColorPalette;
    private localization: ILocalizationManager;
    private root: HTMLElement;
    private selectedKeys = new Set<string>();
    private accent = DEFAULTS.accent;
    // Mirrors the last rendered settings so getFormattingModel shows what the table is
    // actually displaying, including the defaults applied when a property is unset.
    private lastS: Style = { ...DEFAULTS };

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.events = options.host.eventService;
        this.selectionManager = options.host.createSelectionManager();
        this.tooltipService = options.host.tooltipService;
        this.colorPalette = options.host.colorPalette as ISandboxExtendedColorPalette;
        this.localization = options.host.createLocalizationManager?.();
        this.root = options.element;
        this.root.classList.add("gi-table-root");
        this.root.addEventListener("click", () => {
            // Clicking empty space clears the selection - but not when the report author
            // has turned this visual's interactions off (Edit interactions).
            if (this.host.hostCapabilities?.allowInteractions === false) return;
            this.selectionManager.clear(); this.selectedKeys.clear(); this.applySel();
        });
        this.root.addEventListener("contextmenu", (ev) => {
            this.selectionManager.showContextMenu({} as unknown as powerbi.visuals.ISelectionId, { x: ev.clientX, y: ev.clientY });
            ev.preventDefault();
        });
    }

    // Localized string with the English text as the fallback.
    private text(key: string, fallback: string): string {
        try {
            return this.localization?.getDisplayName(key) || fallback;
        } catch {
            return fallback;
        }
    }

    // Shown when no fields are bound yet, so an empty table explains itself.
    private renderLandingPage(): void {
        const page = el("div", "gi-landing");
        const title = el("div", "gi-landing-title"); title.textContent = this.text("Landing_Title", "Grouped Indicator Table");
        const body = el("div", "gi-landing-body");
        body.textContent = this.text("Landing_Body",
            "Bind a field to Group by (merged) for the row groups, one or more to Row columns for "
            + "the detail, and your measures to Values. Delta direction colours the trailing delta "
            + "columns by whether up or down is good.");
        page.appendChild(title); page.appendChild(body);
        this.root.appendChild(page);
    }

    public update(options: VisualUpdateOptions) {
        this.events.renderingStarted(options);
        try {
            const vp = options.viewport;
            if (vp) { this.root.style.width = vp.width + "px"; this.root.style.height = vp.height + "px"; }
            this.root.style.overflow = "auto";
            while (this.root.firstChild) this.root.removeChild(this.root.firstChild);
            const dv: DataView = options.dataViews?.[0];
            const table: DataViewTable | undefined = dv?.table;
            if (!table || !table.columns?.length || !table.rows?.length) {
                this.renderLandingPage();
                this.events.renderingFinished(options);
                return;
            }

            const o = readObjects(dv);
            const s: Style = {
                headerBg: fill(o, "headerBg", DEFAULTS.headerBg), headerColor: fill(o, "headerColor", DEFAULTS.headerColor),
                rowAltBg: fill(o, "rowAltBg", DEFAULTS.rowAltBg), accent: fill(o, "accent", DEFAULTS.accent),
                pillColor: fill(o, "pillColor", DEFAULTS.pillColor), pillBg: fill(o, "pillBg", DEFAULTS.pillBg),
                good: fill(o, "good", DEFAULTS.good), bad: fill(o, "bad", DEFAULTS.bad), neutral: fill(o, "neutral", DEFAULTS.neutral),
                fontFamily: text(o, "fontFamily", DEFAULTS.fontFamily),
                fontSize: num(o, "fontSize", DEFAULTS.fontSize, 4, 200),
                headerSize: num(o, "headerSize", DEFAULTS.headerSize, 4, 200),
                textColor: fill(o, "textColor", DEFAULTS.textColor),
                valueColor: fill(o, "valueColor", DEFAULTS.valueColor),
                groupColor: fill(o, "groupColor", DEFAULTS.groupColor),
                deltaColumnCount: num(o, "deltaColumnCount", DEFAULTS.deltaColumnCount, 0, 20),
                hideEmptyColumns: (o?.["hideEmptyColumns"] as boolean) ?? DEFAULTS.hideEmptyColumns,
                sortByGroup: (o?.["sortByGroup"] as boolean) ?? DEFAULTS.sortByGroup,
                wrapText: (o?.["wrapText"] as boolean) ?? DEFAULTS.wrapText,
                heatmap: (o?.["heatmap"] as boolean) ?? DEFAULTS.heatmap,
                heatmapCenter: (o?.["heatmapCenter"] as number) ?? DEFAULTS.heatmapCenter,
                heatmapLow: fill(o, "heatmapLow", DEFAULTS.heatmapLow),
                heatmapMid: fill(o, "heatmapMid", DEFAULTS.heatmapMid),
                heatmapHigh: fill(o, "heatmapHigh", DEFAULTS.heatmapHigh),
            };
            // High contrast mode: take every colour from the host palette so the table stays
            // legible under the user's accessibility theme, and drop the heatmap shading
            // (a diverging scale carries no meaning in a two-colour theme).
            const hc = this.colorPalette?.isHighContrast === true;
            // The stylesheet's hard-coded hover/selection backgrounds are suppressed under
            // high contrast (they would sit fore-coloured text on a near-white tint).
            this.root.classList.toggle("hc", hc);
            if (hc) {
                const fore = this.colorPalette.foreground?.value;
                const back = this.colorPalette.background?.value;
                s.headerBg = back; s.headerColor = fore; s.rowAltBg = back; s.accent = fore;
                s.pillColor = fore; s.pillBg = back;
                s.good = fore; s.bad = fore; s.neutral = fore;
                s.textColor = fore; s.valueColor = fore; s.groupColor = fore;
                s.heatmap = false;
                // The scrollbar follows the palette too, so the scroll affordance required
                // by policy 1180.2.2 stays visible under an accessibility theme.
                this.root.style.setProperty("--gi-scrollbar-thumb", fore);
                this.root.style.setProperty("--gi-scrollbar-track", back);
            } else {
                this.root.style.removeProperty("--gi-scrollbar-thumb");
                this.root.style.removeProperty("--gi-scrollbar-track");
            }

            this.accent = s.accent;
            this.lastS = s;
            // Wrap mode: headers and cells break onto further lines instead of scrolling sideways.
            this.root.classList.toggle("wrap", s.wrapText);
            // Font family and body colour apply to the whole table so every cell inherits them.
            this.root.style.fontFamily = s.fontFamily;
            this.root.style.color = s.textColor;

            // ---- classify columns by data role (with query-name fallbacks) ----
            const qn = (c: powerbi.DataViewMetadataColumn) => String((c as { queryName?: string }).queryName ?? c.displayName ?? "");
            const cols = table.columns.map((c, i) => {
                const q = qn(c);
                const isHeat = !!c.roles?.["heatMode"];
                const isDir = !isHeat && (!!c.roles?.["direction"] || (!c.roles?.["values"] && !c.isMeasure && /GoodDirection$/i.test(q)));
                const isVal = !isHeat && !isDir && (!!c.roles?.["values"] || !!c.isMeasure || /(^|\.)_?Measures\./i.test(q));
                const isGroup = !isHeat && !isVal && !isDir && (!!c.roles?.["groupBy"] || /IndicatorName$/i.test(q));
                const isDim = !isHeat && !isVal && !isDir && !isGroup;
                return { index: i, name: c.displayName ?? "", isGroup, isVal, isDim, isDir, isHeat };
            });
            const groupCol = cols.find((c) => c.isGroup);
            // hideEmptyColumns (opt-in): drop value columns that are entirely empty/"-" across all rows,
            // so a slicer that blanks out other groups' measures collapses the table down to just the
            // populated columns.
            const nonEmptyVal = (c: { index: number }) => table.rows.some((r) => {
                const v = r[c.index]; return v != null && String(v).trim() !== "" && String(v).trim() !== "-";
            });
            const valCols = cols.filter((c) => c.isVal).filter((c) => !s.hideEmptyColumns || nonEmptyVal(c));
            const dimCols = cols.filter((c) => c.isDim);
            const dirCol = cols.find((c) => c.isDir);
            const heatModeCol = cols.find((c) => c.isHeat);
            // heatmap is active when: the heatMode role is bound -> only when its value reads
            // On / True / Yes / 1; otherwise fall back to the static heatmap format property.
            const heatModeVal = heatModeCol ? String(table.rows.find((r) => r[heatModeCol.index] != null)?.[heatModeCol.index] ?? "") : null;
            const heatOn = heatActive(heatModeCol ? heatModeVal : null, s.heatmap);
            const display = [groupCol, ...dimCols, ...valCols].filter(Boolean) as typeof cols;

            // trailing value columns are deltas (coloured by direction); a leading text value column is
            // the "merge" column (e.g. an item name) that several rows share.
            const deltaSet = new Set(valCols.slice(Math.max(0, valCols.length - s.deltaColumnCount)).map((c) => c.index));
            const textValSet = new Set(valCols.filter((c) => !deltaSet.has(c.index) && table.rows.some((r) => hasAlpha(r[c.index]))).map((c) => c.index));
            const mergeCol = valCols.find((c) => textValSet.has(c.index));
            // MERGE MODE: rows are detail rows, but the shared value columns (e.g. name, source,
            // current, comparison, delta) collapse into one centred cell spanning the rows that share them.
            const mergeMode = !!mergeCol && (!!groupCol || dimCols.length > 0);
            const mergedIdx = new Set<number>(mergeMode ? valCols.map((c) => c.index) : []);

            // pill the group column when its values look like short codes (e.g. C57); else the first dim
            const pillGroup = !!groupCol && table.rows.every((r) => { const v = String(r[groupCol.index] ?? ""); return v.length <= 6 && /^[A-Za-z]+\d+$/.test(v); });
            const pillIdx = pillGroup ? groupCol!.index : (dimCols.length ? dimCols[0].index : -1);

            // ---- build row groups ----
            let rowIdx = table.rows.map((_, i) => i);
            let keyOf: (i: number) => string;
            if (mergeMode) {
                const mi = mergeCol!.index;
                rowIdx = rowIdx.filter((i) => hasAlpha(table.rows[i][mi]));        // drop rows whose merge value is empty ("-")
                keyOf = (i) => String(table.rows[i][mi] ?? "");
                const gi = groupCol ? groupCol.index : (dimCols[0] ? dimCols[0].index : mi);
                const sk = (i: number) => s.sortByGroup
                    ? String(table.rows[i][gi] ?? "") + "~~" + keyOf(i)             // stable order by the group column first
                    : keyOf(i) + "~~" + String(table.rows[i][gi] ?? "");
                rowIdx.sort((a, b) => sk(a).localeCompare(sk(b)));                  // contiguous groups, stable inner order
            } else {
                keyOf = (i) => (groupCol ? String(table.rows[i][groupCol.index] ?? "") : String(i));
            }
            const order: string[] = []; const groups = new Map<string, number[]>();
            rowIdx.forEach((i) => { const k = keyOf(i); if (!groups.has(k)) { groups.set(k, []); order.push(k); } groups.get(k)!.push(i); });

            // heatmap scale: largest distance from centre across the numeric (non-delta) value cells
            let hmSpan = 0;
            if (heatOn) {
                for (const c of valCols) {
                    if (textValSet.has(c.index) || deltaSet.has(c.index)) continue;
                    for (const ri of rowIdx) { const n = toNum(table.rows[ri][c.index]); if (n !== null) hmSpan = Math.max(hmSpan, Math.abs(n - s.heatmapCenter)); }
                }
                if (hmSpan === 0) hmSpan = 1;
            }
            const lo = hex(s.heatmapLow), mid = hex(s.heatmapMid), hi = hex(s.heatmapHigh);

            const tbl = el("table", "gi-table") as HTMLTableElement;
            tbl.style.fontSize = s.fontSize + "px";

            // header
            const thead = el("thead"); const htr = el("tr");
            for (const c of display) {
                const th = el("th"); th.textContent = c.name; th.style.background = s.headerBg; th.style.color = s.headerColor;
                th.style.fontSize = s.headerSize + "px";
                if (deltaSet.has(c.index) || (c.isVal && !textValSet.has(c.index))) th.style.textAlign = "right";
                htr.appendChild(th);
            }
            thead.appendChild(htr); tbl.appendChild(thead);

            const tbody = el("tbody");
            order.forEach((gkey, gi) => {
                const rowIdxs = groups.get(gkey)!;
                // Even groups are plain white - except in high contrast, where every row
                // takes the host background so text never lands on hard-coded white.
                const groupBg = gi % 2 === 1 || hc ? s.rowAltBg : "#FFFFFF";
                const direction = dirCol ? String(table.rows[rowIdxs[0]][dirCol.index] ?? "") : "";
                // group selection: clicking any row selects the whole group -> cross-filters the page
                const groupIds: powerbi.extensibility.ISelectionId[] = [];
                for (const gri of rowIdxs) { try { groupIds.push(this.host.createSelectionIdBuilder().withTable(table, gri).createSelectionId()); } catch { /* ignore */ } }

                rowIdxs.forEach((ri, j) => {
                    const tr = el("tr") as HTMLTableRowElement;
                    tr.dataset.gkey = gkey;
                    tr.style.background = groupBg;
                    if (j === 0) tr.classList.add("grp-first");

                    for (const c of display) {
                        const isMerged = mergedIdx.has(c.index);
                        if (isMerged && j !== 0) continue;                          // spanned from the first row
                        const td = el("td");
                        if (isMerged) { (td as HTMLTableCellElement).rowSpan = rowIdxs.length; td.classList.add("merged"); }
                        const text = String(table.rows[ri][c.index] ?? "");
                        if (deltaSet.has(c.index)) {
                            td.style.textAlign = "right"; td.classList.add("num");
                            const cls = deltaClass(text, direction);
                            td.style.color = cls === "good" ? s.good : cls === "bad" ? s.bad : s.neutral;
                            td.style.fontWeight = "700"; td.textContent = text;
                        } else if (c.isVal && !textValSet.has(c.index)) {
                            td.style.textAlign = "right"; td.classList.add("num");
                            const raw = table.rows[ri][c.index];
                            td.textContent = fmtNum(raw, (table.columns[c.index] as { format?: string }).format);
                            const n = heatOn ? toNum(raw) : null;
                            if (n !== null) {
                                const col = divergingColor(n, s.heatmapCenter, hmSpan, lo, mid, hi);
                                td.style.background = col.bg; td.style.color = col.fg;
                            } else { td.style.color = s.valueColor; }
                        } else if (c.index === pillIdx) {
                            const pill = el("span", "gi-pill"); pill.textContent = text; pill.style.color = s.pillColor; pill.style.background = s.pillBg; td.appendChild(pill);
                        } else if (c.isVal) {                                        // merged text value (e.g. name / source)
                            td.style.color = s.valueColor; td.textContent = text;
                        } else if (c.isGroup) { td.classList.add("grp-key"); td.style.color = s.groupColor; td.textContent = text; }
                        else td.textContent = text;
                        tr.appendChild(td);
                    }

                    // Keyboard access: rows are focusable and Enter or Space selects them.
                    tr.tabIndex = 0;
                    tr.setAttribute("role", "row");

                    // Host tooltip: the whole row, column by column. Touch devices get the
                    // same tooltip from a tap (pointerdown) - mousemove never fires there.
                    const showTip = (ev: MouseEvent, isTouch: boolean) => {
                        const rect = this.root.getBoundingClientRect();
                        this.tooltipService?.show({
                            coordinates: [ev.clientX - rect.left, ev.clientY - rect.top],
                            isTouchEvent: isTouch,
                            dataItems: display.map((c) => ({
                                displayName: c.name || String(c.index),
                                value: String(table.rows[ri][c.index] ?? ""),
                            })),
                            identities: groupIds.length ? [groupIds[0]] : [],
                        });
                    };
                    tr.addEventListener("mousemove", (ev) => showTip(ev, false));
                    tr.addEventListener("pointerdown", (ev: PointerEvent) => { if (ev.pointerType === "touch") showTip(ev, true); });
                    tr.addEventListener("mouseleave", () => this.tooltipService?.hide({ immediately: true, isTouchEvent: false }));

                    tr.addEventListener("keydown", (ev: KeyboardEvent) => {
                        if (ev.key !== "Enter" && ev.key !== " ") return;
                        ev.preventDefault();
                        selectGroup(ev.ctrlKey || ev.metaKey);
                    });

                    const selectGroup = (multi: boolean) => {
                        // Honour the report's Edit interactions setting.
                        if (this.host.hostCapabilities?.allowInteractions === false) return;
                        const isOnly = !multi && this.selectedKeys.size === 1 && this.selectedKeys.has(gkey);
                        const after = () => {
                            if (multi) { this.selectedKeys.has(gkey) ? this.selectedKeys.delete(gkey) : this.selectedKeys.add(gkey); }
                            else { this.selectedKeys.clear(); if (!isOnly) this.selectedKeys.add(gkey); }
                            this.applySel();
                        };
                        try {
                            if (!groupIds.length) { after(); return; }
                            if (isOnly) this.selectionManager.clear().then(after);
                            else this.selectionManager.select(groupIds, multi).then(after);
                        } catch { after(); }
                    };

                    tr.addEventListener("click", (ev) => {
                        ev.stopPropagation();
                        selectGroup(ev.ctrlKey || ev.metaKey);
                    });
                    tr.addEventListener("contextmenu", (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        this.selectionManager.showContextMenu(groupIds[0] ?? ({} as unknown as powerbi.visuals.ISelectionId), { x: ev.clientX, y: ev.clientY });
                    });
                    tbody.appendChild(tr);
                });
            });
            tbl.appendChild(tbody);
            this.root.appendChild(tbl);
            this.applySel();
            this.events.renderingFinished(options);
        } catch (e) { this.events.renderingFailed(options, String(e)); }
    }

    private applySel() {
        const rows = this.root.querySelectorAll<HTMLTableRowElement>("tbody tr");
        const any = this.selectedKeys.size > 0;
        rows.forEach((tr) => {
            const sel = !!tr.dataset.gkey && this.selectedKeys.has(tr.dataset.gkey);
            tr.classList.toggle("sel", sel);
            tr.style.opacity = any && !sel ? "0.5" : "1";
            const firstTd = tr.querySelector("td");
            if (firstTd) (firstTd as HTMLElement).style.boxShadow = sel ? `inset 3px 0 0 ${this.accent}` : "";
        });
    }
    // --- Format pane -------------------------------------------------------
    // Every property declared in capabilities.json is surfaced here. At API 5.x the pane is
    // built solely from this model, so anything omitted is unreachable to the report author.

    private static desc(prop: string): powerbi.visuals.FormattingDescriptor {
        return { objectName: "tableStyle", propertyName: prop };
    }

    private colorSlice(uid: string, name: string, prop: string, val: string): powerbi.visuals.FormattingSlice {
        return {
            uid, displayName: name,
            control: {
                type: powerbi.visuals.FormattingComponent.ColorPicker,
                properties: { descriptor: Visual.desc(prop), value: { value: val } }
            }
        };
    }

    private numSlice(uid: string, name: string, prop: string, val: number, min: number, max: number, unit?: string): powerbi.visuals.FormattingSlice {
        return {
            uid, displayName: name,
            control: {
                type: powerbi.visuals.FormattingComponent.NumUpDown,
                properties: {
                    descriptor: Visual.desc(prop),
                    value: val,
                    options: {
                        unitSymbol: unit,
                        minValue: { type: powerbi.visuals.ValidatorType.Min, value: min },
                        maxValue: { type: powerbi.visuals.ValidatorType.Max, value: max }
                    }
                }
            }
        };
    }

    private toggleSlice(uid: string, name: string, prop: string, val: boolean): powerbi.visuals.FormattingSlice {
        return {
            uid, displayName: name,
            control: {
                type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                properties: { descriptor: Visual.desc(prop), value: val }
            }
        };
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        const s = this.lastS;
        return {
            cards: [
                {
                    uid: "tableTextCard", displayName: "Text",
                    groups: [
                        {
                            uid: "tableFontGroup", displayName: "Font",
                            slices: [
                                {
                                    uid: "tableFontFamilySlice", displayName: "Font family",
                                    control: {
                                        type: powerbi.visuals.FormattingComponent.FontPicker,
                                        properties: { descriptor: Visual.desc("fontFamily"), value: s.fontFamily }
                                    }
                                },
                                this.numSlice("tableFontSizeSlice", "Body font size", "fontSize", s.fontSize, 4, 200, "px"),
                                this.numSlice("tableHeaderSizeSlice", "Header font size", "headerSize", s.headerSize, 4, 200, "px")
                            ]
                        },
                        {
                            uid: "tableTextColourGroup", displayName: "Text colours",
                            slices: [
                                this.colorSlice("tText", "Body text", "textColor", s.textColor),
                                this.colorSlice("tValue", "Value cells", "valueColor", s.valueColor),
                                this.colorSlice("tGroupLabel", "Group label", "groupColor", s.groupColor)
                            ]
                        }
                    ]
                },
                {
                    uid: "tableColoursCard", displayName: "Colours",
                    groups: [
                        {
                            uid: "tableChromeGroup", displayName: "Table",
                            slices: [
                                this.colorSlice("tHeaderBg", "Header background", "headerBg", s.headerBg),
                                this.colorSlice("tHeaderText", "Header text", "headerColor", s.headerColor),
                                this.colorSlice("tRowAlt", "Alternating row", "rowAltBg", s.rowAltBg),
                                this.colorSlice("tAccent", "Accent", "accent", s.accent)
                            ]
                        },
                        {
                            uid: "tableIndicatorGroup", displayName: "Indicators",
                            slices: [
                                this.colorSlice("tGood", "Up / good", "good", s.good),
                                this.colorSlice("tBad", "Down / bad", "bad", s.bad),
                                this.colorSlice("tNeutral", "Neutral", "neutral", s.neutral)
                            ]
                        },
                        {
                            uid: "tablePillGroup", displayName: "Code pills",
                            slices: [
                                this.colorSlice("tPillText", "Pill text", "pillColor", s.pillColor),
                                this.colorSlice("tPillBg", "Pill background", "pillBg", s.pillBg)
                            ]
                        }
                    ]
                },
                {
                    uid: "tableLayoutCard", displayName: "Layout",
                    groups: [{
                        uid: "tableLayoutGroup", displayName: "Layout",
                        slices: [
                            this.numSlice("tDeltaCols", "Delta columns (from right)", "deltaColumnCount", s.deltaColumnCount, 0, 20),
                            this.toggleSlice("tHideEmpty", "Hide empty columns", "hideEmptyColumns", s.hideEmptyColumns),
                            this.toggleSlice("tSortByGroup", "Sort by group name", "sortByGroup", s.sortByGroup),
                            this.toggleSlice("tWrapText", "Wrap text", "wrapText", s.wrapText)
                        ]
                    }]
                },
                {
                    uid: "tableHeatmapCard", displayName: "Heatmap",
                    groups: [{
                        uid: "tableHeatmapGroup", displayName: "Heatmap",
                        slices: [
                            this.toggleSlice("tHeatmap", "Shade numeric cells", "heatmap", s.heatmap),
                            this.numSlice("tHeatCenter", "Centre value", "heatmapCenter", s.heatmapCenter, -1000000, 1000000),
                            this.colorSlice("tHeatLow", "Below centre", "heatmapLow", s.heatmapLow),
                            this.colorSlice("tHeatMid", "At centre", "heatmapMid", s.heatmapMid),
                            this.colorSlice("tHeatHigh", "Above centre", "heatmapHigh", s.heatmapHigh)
                        ]
                    }]
                }
            ]
        };
    }
}
