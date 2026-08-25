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
    fontSize: number; deltaColumnCount: number; hideEmptyColumns: boolean; sortByGroup: boolean;
    heatmap: boolean; heatmapCenter: number; heatmapLow: string; heatmapMid: string; heatmapHigh: string;
}
const DEFAULTS: Style = {
    headerBg: "#023864", headerColor: "#FFFFFF", rowAltBg: "#f6faf9", accent: "#1F908C",
    pillColor: "#016C8D", pillBg: "#e7f1f4", good: "#0F7A2C", bad: "#9E2F24", neutral: "#605E5C",
    fontSize: 12, deltaColumnCount: 1, hideEmptyColumns: false, sortByGroup: false,
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
    private lastFontSize = DEFAULTS.fontSize;
    private lastC = { headerBg: DEFAULTS.headerBg, headerColor: DEFAULTS.headerColor, rowAltBg: DEFAULTS.rowAltBg, accent: DEFAULTS.accent, good: DEFAULTS.good, bad: DEFAULTS.bad, neutral: DEFAULTS.neutral };

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.events = options.host.eventService;
        this.selectionManager = options.host.createSelectionManager();
        this.tooltipService = options.host.tooltipService;
        this.colorPalette = options.host.colorPalette as ISandboxExtendedColorPalette;
        this.localization = options.host.createLocalizationManager?.();
        this.root = options.element;
        this.root.classList.add("gi-table-root");
        this.root.addEventListener("click", () => { this.selectionManager.clear(); this.selectedKeys.clear(); this.applySel(); });
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
                fontSize: (o?.["fontSize"] as number) ?? DEFAULTS.fontSize,
                deltaColumnCount: (o?.["deltaColumnCount"] as number) ?? DEFAULTS.deltaColumnCount,
                hideEmptyColumns: (o?.["hideEmptyColumns"] as boolean) ?? DEFAULTS.hideEmptyColumns,
                sortByGroup: (o?.["sortByGroup"] as boolean) ?? DEFAULTS.sortByGroup,
                heatmap: (o?.["heatmap"] as boolean) ?? DEFAULTS.heatmap,
                heatmapCenter: (o?.["heatmapCenter"] as number) ?? DEFAULTS.heatmapCenter,
                heatmapLow: fill(o, "heatmapLow", DEFAULTS.heatmapLow),
                heatmapMid: fill(o, "heatmapMid", DEFAULTS.heatmapMid),
                heatmapHigh: fill(o, "heatmapHigh", DEFAULTS.heatmapHigh),
            };
            // High contrast mode: take every colour from the host palette so the table stays
            // legible under the user's accessibility theme, and drop the heatmap shading
            // (a diverging scale carries no meaning in a two-colour theme).
            if (this.colorPalette?.isHighContrast === true) {
                const fore = this.colorPalette.foreground?.value;
                const back = this.colorPalette.background?.value;
                s.headerBg = back; s.headerColor = fore; s.rowAltBg = back; s.accent = fore;
                s.pillColor = fore; s.pillBg = back;
                s.good = fore; s.bad = fore; s.neutral = fore;
                s.heatmap = false;
            }

            this.accent = s.accent;
            this.lastFontSize = s.fontSize;
            this.lastC = { headerBg: s.headerBg, headerColor: s.headerColor, rowAltBg: s.rowAltBg, accent: s.accent, good: s.good, bad: s.bad, neutral: s.neutral };

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
                if (deltaSet.has(c.index) || (c.isVal && !textValSet.has(c.index))) th.style.textAlign = "right";
                htr.appendChild(th);
            }
            thead.appendChild(htr); tbl.appendChild(thead);

            const tbody = el("tbody");
            order.forEach((gkey, gi) => {
                const rowIdxs = groups.get(gkey)!;
                const groupBg = gi % 2 === 1 ? s.rowAltBg : "#FFFFFF";
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
                            } else { td.style.color = "#023864"; }
                        } else if (c.index === pillIdx) {
                            const pill = el("span", "gi-pill"); pill.textContent = text; pill.style.color = s.pillColor; pill.style.background = s.pillBg; td.appendChild(pill);
                        } else if (c.isVal) {                                        // merged text value (e.g. name / source)
                            td.style.color = "#023864"; td.textContent = text;
                        } else if (c.isGroup) { td.classList.add("grp-key"); td.textContent = text; }
                        else td.textContent = text;
                        tr.appendChild(td);
                    }

                    // Keyboard access: rows are focusable and Enter or Space selects them.
                    tr.tabIndex = 0;
                    tr.setAttribute("role", "row");

                    // Host tooltip: the whole row, column by column.
                    tr.addEventListener("mousemove", (ev) => {
                        const rect = this.root.getBoundingClientRect();
                        this.tooltipService?.show({
                            coordinates: [ev.clientX - rect.left, ev.clientY - rect.top],
                            isTouchEvent: false,
                            dataItems: display.map((c) => ({
                                displayName: c.name || String(c.index),
                                value: String(table.rows[ri][c.index] ?? ""),
                            })),
                            identities: groupIds.length ? [groupIds[0]] : [],
                        });
                    });
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
    private colorSlice(uid: string, name: string, prop: string, val: string): powerbi.visuals.FormattingSlice {
        return {
            uid, displayName: name,
            control: {
                type: powerbi.visuals.FormattingComponent.ColorPicker,
                properties: { descriptor: { objectName: "tableStyle", propertyName: prop }, value: { value: val } }
            }
        };
    }
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        const c = this.lastC;
        return {
            cards: [
                {
                    uid: "tableStyleCard", displayName: "Text",
                    groups: [{ uid: "tableTextGroup", displayName: "Text", slices: [{
                        uid: "tableFontSizeSlice", displayName: "Font size",
                        control: { type: powerbi.visuals.FormattingComponent.NumUpDown, properties: { descriptor: { objectName: "tableStyle", propertyName: "fontSize" }, value: this.lastFontSize } }
                    }] }]
                },
                {
                    uid: "tableColoursCard", displayName: "Colours",
                    groups: [{ uid: "tableColoursGroup", displayName: "Colours", slices: [
                        this.colorSlice("tHeaderBg", "Header background", "headerBg", c.headerBg),
                        this.colorSlice("tHeaderText", "Header text", "headerColor", c.headerColor),
                        this.colorSlice("tRowAlt", "Alternating row", "rowAltBg", c.rowAltBg),
                        this.colorSlice("tAccent", "Accent", "accent", c.accent),
                        this.colorSlice("tGood", "Up / good", "good", c.good),
                        this.colorSlice("tBad", "Down / bad", "bad", c.bad),
                        this.colorSlice("tNeutral", "Neutral", "neutral", c.neutral)
                    ] }]
                }
            ]
        };
    }
}
