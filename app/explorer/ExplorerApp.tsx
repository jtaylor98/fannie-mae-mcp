"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./explorer.module.css";

/* ------------------------------------------------------------------ types */
type ParamKind = "scalar" | "itemList";
interface OpParam {
  name: string;
  type: "string" | "number";
  example: string | number;
  kind?: ParamKind;
  fields?: string[];
  hint?: string;
  optional?: boolean;
}
interface Operation {
  id: string;
  label: string;
  params: OpParam[];
  method?: "GET" | "POST";
  note?: string;
}
interface ApiEntry {
  name: string;
  tag: string;
  description: string;
  implemented?: boolean;
  operations?: Operation[];
  status?: "ok" | "unreachable";
  statusNote?: string;
  businessLine: string;
}
interface Catalog {
  apis: ApiEntry[];
  businessLineOrder: string[];
}
interface Geom { x: number; y: number; w: number; h: number; }
interface Panel {
  uid: string;
  apiName: string;
  opId: string;
  opLabel: string;
  method: "GET" | "POST";
  params: Record<string, string>;
  status: "loading" | "done" | "error";
  data?: any;
  error?: string;
  x: number; y: number; w: number; h: number; z: number;
}
type SeedPanel = Omit<Panel, "x" | "y" | "w" | "h" | "z">;
interface SavedQuery {
  id: string;
  name: string;
  apiName: string;
  opId: string;
  opLabel: string;
  params: Record<string, string>;
}

/* -------------------------------------------------------------- utilities */
let uidCounter = 0;
const uid = () => `p${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

const isNum = (v: any): v is number => typeof v === "number" && isFinite(v);
const looksMoney = (k: string) => /(upb|balance|amount|amt|value|price|limit|dollar|proceeds|principal|unpaid)/i.test(k);
const looksPct = (k: string) => /(rate|pct|percent|ratio|yield|coupon|dti|ltv)/i.test(k);
const looksIdUrl = (k: string) => /(^id$|_id$|\bid\b|uri|url|link|timestamp|guid|uuid|arn|hash|s3)/i.test(k);
const looksDate = (k: string) => /(date|week|month|period|time|year)/i.test(k);

function fmtNum(n: any) { try { return Number(n).toLocaleString("en-US"); } catch { return String(n); } }
function fmtMoney(n: any) { try { return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 }); } catch { return String(n); } }
function fmtPct(n: number) { const v = Math.abs(n) <= 1 ? n * 100 : n; return Math.round(v * 100) / 100 + "%"; }
function fmtDate(s: string) {
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return String(s);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let out = `${months[+m[2] - 1]} ${+m[3]}, ${m[1]}`;
  if (m[4] != null) out += ` ${m[4]}:${m[5]}`;
  return out;
}
function fmtValue(key: string, v: any): string {
  if (v == null) return "—";
  if (isNum(v)) {
    if (looksPct(key)) return fmtPct(v);
    if (looksMoney(key)) return fmtMoney(v);
    if (Number.isInteger(v) || Math.abs(v) >= 1000) return fmtNum(v);
    return String(v);
  }
  if (typeof v === "boolean") return v ? "Yes" : "No";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(s)) return fmtDate(s);
  return s;
}
const humanize = (k: string) =>
  String(k).replace(/[_\-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
const truncate = (s: any, n: number) => { const t = String(s); return t.length > n ? t.slice(0, n) + "…" : t; };
const safeJson = (d: any) => { try { return JSON.stringify(d, null, 2); } catch { return String(d); } };

const isRecordArray = (v: any): v is Record<string, any>[] =>
  Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === "object" && !Array.isArray(x));

function recordsFrom(data: any, depth = 0): Record<string, any>[] | null {
  if (Array.isArray(data)) return isRecordArray(data) ? data : null;
  if (data && typeof data === "object" && depth < 4) {
    const keys = Object.keys(data);
    for (const k of keys) if (isRecordArray(data[k])) return data[k];
    for (const k of keys) {
      const v = data[k];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const f = recordsFrom(v, depth + 1);
        if (f) return f;
      }
    }
  }
  return null;
}
function isStatusObject(data: any): boolean {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const keys = Object.keys(data).map((k) => k.toLowerCase());
  const hasS3 = keys.some((k) => k.includes("s3"));
  const hasState = keys.some((k) => k === "currentstate" || k === "state" || k === "status");
  const hasReq = keys.some((k) => k.includes("request") && k.includes("id"));
  const hasTs = keys.some((k) => k.includes("timestamp"));
  return Object.keys(data).length <= 12 && (hasS3 || (hasState && (hasReq || hasTs)));
}
type ViewType = "status" | "detail" | "table" | "json";
function detectType(data: any): ViewType {
  if (data == null || typeof data !== "object") return "json";
  if (isStatusObject(data)) return "status";
  if (recordsFrom(data)) return "table";
  if (!Array.isArray(data)) {
    const vals = Object.values(data);
    const scalarish = vals.filter((v) => v == null || typeof v !== "object").length;
    if (vals.length && scalarish >= Math.ceil(vals.length * 0.6)) return "detail";
  }
  return "json";
}
function unionKeys(records: Record<string, any>[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of records) for (const k of Object.keys(r)) if (!seen.has(k)) { seen.add(k); out.push(k); }
  return out;
}
function distinctVals(records: Record<string, any>[], col: string): string[] {
  const s = new Set<string>();
  for (const r of records) s.add(r[col] == null ? "" : String(r[col]));
  return [...s];
}
const colIsSelect = (records: Record<string, any>[], col: string) => distinctVals(records, col).length <= 40;
function applyFilters(records: Record<string, any>[], filters: Record<string, string>): Record<string, any>[] {
  const active = Object.entries(filters).filter(([, v]) => v != null && v !== "");
  if (!active.length) return records;
  return records.filter((r) =>
    active.every(([col, val]) => {
      const cell = r[col] == null ? "" : String(r[col]);
      if (colIsSelect(records, col)) return cell === val;
      return cell.toLowerCase().includes(String(val).toLowerCase());
    })
  );
}
function toCSV(records: Record<string, any>[], cols: string[]): string {
  const q = (v: any) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [cols.map(q).join(","), ...records.map((r) => cols.map((c) => q(r[c])).join(","))].join("\n");
}
function downloadText(name: string, text: string, mime = "text/csv") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
function copy(text: string) {
  try { navigator.clipboard?.writeText(text); } catch { /* ignore */ }
}

/* ---------------------------------------------------------------- charts */
type ChartPick = { x: string; y: string } | null;
function pickChart(records: Record<string, any>[], cols: string[]): ChartPick {
  if (records.length < 2 || records.length > 60) return null;
  let x: string | null = null, y: string | null = null;
  for (const c of cols) {
    const sample = records.map((r) => r[c]);
    const allStr = sample.every((v) => typeof v === "string" || v == null);
    const distinct = new Set(sample.map((v) => String(v))).size;
    if (!x && allStr && !looksIdUrl(c) && distinct === records.length) x = c;
  }
  if (!x) { const dc = cols.find((c) => looksDate(c) && new Set(records.map((r) => String(r[c]))).size === records.length); if (dc) x = dc; }
  for (const c of cols) { if (c === x) continue; if (records.every((r) => isNum(r[c])) && !looksIdUrl(c)) { y = c; break; } }
  return x && y ? { x, y } : null;
}

function Chart({ records, x, y }: { records: Record<string, any>[]; x: string; y: string }) {
  const [kind, setKind] = useState<"bar" | "line">(looksDate(x) ? "line" : "bar");
  const pts = records
    .map((r) => ({ label: String(r[x] == null ? "" : r[x]), value: Number(r[y]) }))
    .filter((p) => isFinite(p.value));
  if (!pts.length) return null;
  const W = 520, H = 190, padL = 40, padR = 12, padT = 10, padB = 26;
  const max = Math.max(...pts.map((p) => p.value), 0);
  const min = Math.min(...pts.map((p) => p.value), 0);
  const span = max - min || 1;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const yOf = (v: number) => padT + plotH - ((v - min) / span) * plotH;
  const step = pts.length > 1 ? plotW / (pts.length - 1) : 0;
  const xOfLine = (i: number) => padL + (pts.length > 1 ? i * step : plotW / 2);
  const everyLabel = Math.ceil(pts.length / 8);

  const yTicks = [min, min + span / 2, max];

  return (
    <div>
      <div className={styles["chart-t"]}>
        {humanize(y)} by {humanize(x)}
        <span className={styles["chart-tabs"]} style={{ marginLeft: 8 }}>
          {(["bar", "line"] as const).map((k) => (
            <button key={k} className={styles.mini} style={kind === k ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined} onClick={() => setKind(k)}>{k}</button>
          ))}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles["chart-svg"]} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${humanize(y)} by ${humanize(x)}`}>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={yOf(t)} x2={W - padR} y2={yOf(t)} className={styles["chart-axisline"]} />
            <text x={padL - 4} y={yOf(t) + 3} textAnchor="end" className={styles["chart-axis"]}>{fmtNum(Math.round(t))}</text>
          </g>
        ))}
        {kind === "bar"
          ? pts.map((p, i) => {
              const bw = Math.max(3, Math.min(34, plotW / pts.length - 4));
              const cx = padL + (i + 0.5) * (plotW / pts.length);
              const h = ((p.value - min) / span) * plotH;
              return (
                <g key={i}>
                  <rect x={cx - bw / 2} y={padT + plotH - h} width={bw} height={Math.max(h, 0)} rx={2} fill="var(--accent)">
                    <title>{`${p.label}: ${fmtValue(y, p.value)}`}</title>
                  </rect>
                  {i % everyLabel === 0 && <text x={cx} y={H - padB + 12} textAnchor="middle" className={styles["chart-axis"]}>{truncate(p.label, 8)}</text>}
                </g>
              );
            })
          : (
            <>
              <polyline fill="none" stroke="var(--accent)" strokeWidth={2} points={pts.map((p, i) => `${xOfLine(i)},${yOf(p.value)}`).join(" ")} />
              {pts.map((p, i) => (
                <g key={i}>
                  <circle cx={xOfLine(i)} cy={yOf(p.value)} r={2.4} fill="var(--accent)"><title>{`${p.label}: ${fmtValue(y, p.value)}`}</title></circle>
                  {i % everyLabel === 0 && <text x={xOfLine(i)} y={H - padB + 12} textAnchor="middle" className={styles["chart-axis"]}>{truncate(p.label, 8)}</text>}
                </g>
              ))}
            </>
          )}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------ result views */
function StatusCard({ data }: { data: Record<string, any> }) {
  const keys = Object.keys(data);
  const byLc = (pred: (k: string) => boolean) => keys.find((k) => pred(k.toLowerCase()));
  const stateKey = byLc((k) => k === "currentstate" || k === "state" || k === "status");
  const state = stateKey ? data[stateKey] : "";
  const done = /complete|success|ready|done|finished/i.test(String(state));
  const s3Key = byLc((k) => k.includes("s3"));
  const s3 = s3Key ? data[s3Key] : null;
  const reqKey = byLc((k) => k.includes("request") && k.includes("id"));
  const tsKey = byLc((k) => k.includes("timestamp") || k.includes("generated"));
  const periodKey = byLc((k) => k.includes("period"));
  const rows: [string, any][] = [];
  if (periodKey) rows.push(["Reporting period", fmtValue(periodKey, data[periodKey])]);
  if (tsKey) rows.push(["Generated", fmtValue(tsKey, data[tsKey])]);
  if (reqKey) rows.push(["Request ID", truncate(data[reqKey], 16)]);
  return (
    <div className={styles["rr-status"]}>
      <div><span className={`${styles["rr-badge"]} ${done ? styles.ok : ""}`}>{done ? "✓ " : ""}{String(state) || "Result"}</span></div>
      {rows.length > 0 && (
        <div className={styles["rr-kv"]} style={{ marginTop: 8 }}>
          {rows.map(([k, v]) => (<div key={k} style={{ display: "contents" }}><div className={styles["rr-k"]}>{k}</div><div className={styles["rr-v"]}>{String(v)}</div></div>))}
        </div>
      )}
      {s3 && (
        <div className={styles["rr-actions"]}>
          <a className={styles.linklike} href={String(s3)} target="_blank" rel="noreferrer">Open result ↗</a>
          <button className={`${styles.linklike} ${styles.ghost}`} onClick={() => copy(String(s3))}>Copy URI</button>
        </div>
      )}
    </div>
  );
}

function DetailCard({ data }: { data: Record<string, any> }) {
  const rows = Object.entries(data).filter(([, v]) => v == null || typeof v !== "object");
  return (
    <div className={styles["rr-kv"]}>
      {rows.map(([k, v]) => {
        const long = typeof v === "string" && (looksIdUrl(k) || v.length > 44) && v.length > 24;
        return (
          <div key={k} style={{ display: "contents" }}>
            <div className={styles["rr-k"]}>{humanize(k)}</div>
            <div className={styles["rr-v"]}>
              {long ? (<><span className={styles["rr-mono"]}>{truncate(v, 46)}</span>{" "}<button className={styles.mini} onClick={() => copy(String(v))}>Copy</button></>) : fmtValue(k, v)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DataTable({ records, title }: { records: Record<string, any>[]; title: string }) {
  const cols = useMemo(() => unionKeys(records), [records]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ col: string; dir: "asc" | "desc" } | null>(null);
  const CAP = 100;

  const filtered = useMemo(() => applyFilters(records, filters), [records, filters]);
  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const dir = sort.dir === "desc" ? -1 : 1;
    return [...filtered].sort((a, b) => {
      const av = a[sort.col], bv = b[sort.col];
      if (isNum(av) && isNum(bv)) return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
  }, [filtered, sort]);
  const shown = sorted.slice(0, CAP);
  const chart = useMemo(() => pickChart(records, cols), [records, cols]);
  const hasFilters = Object.values(filters).some((v) => v);

  const setFilter = (col: string, val: string) =>
    setFilters((f) => { const n = { ...f }; if (val) n[col] = val; else delete n[col]; return n; });
  const toggleSort = (col: string) =>
    setSort((s) => (s && s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }));

  return (
    <div>
      {chart && <div style={{ marginBottom: 10 }}><Chart records={records} x={chart.x} y={chart.y} /></div>}
      <div className={styles.tabtools}>
        <span className={styles.rownote}>
          Showing {shown.length} of {fmtNum(sorted.length)}{sorted.length !== records.length ? ` (filtered from ${fmtNum(records.length)})` : ""} rows
        </span>
        <span className={styles["tabtools-r"]}>
          {hasFilters && <button className={styles.mini} onClick={() => setFilters({})}>Clear filters</button>}
          <button className={styles.mini} onClick={() => copy(toCSV(sorted, cols))}>Copy CSV</button>
          <button className={styles.mini} onClick={() => downloadText(`${title}.csv`, toCSV(sorted, cols))}>Download CSV</button>
        </span>
      </div>
      <div className={styles.tablewrap}>
        <table className={styles.tbl}>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c} onClick={() => toggleSort(c)}>
                  {humanize(c)}{sort && sort.col === c ? (sort.dir === "desc" ? " ▾" : " ▴") : ""}
                </th>
              ))}
            </tr>
            <tr className={styles["filter-row"]}>
              {cols.map((c) => {
                const cur = filters[c] || "";
                const active = cur !== "";
                const sel = colIsSelect(records, c);
                return (
                  <th key={c}>
                    <div className={`${styles.fwrap} ${active ? styles.active : ""}`}>
                      {sel ? (
                        <select className={styles.filter} value={cur} onChange={(e) => setFilter(c, e.target.value)} aria-label={`Filter by ${humanize(c)}`}>
                          <option value="">All</option>
                          {distinctVals(records, c).sort().map((v) => (<option key={v} value={v}>{v === "" ? "Blank" : v}</option>))}
                        </select>
                      ) : (
                        <input className={styles.filter} value={cur} placeholder={`Filter ${humanize(c).toLowerCase()}…`} onChange={(e) => setFilter(c, e.target.value)} aria-label={`Filter by ${humanize(c)}`} />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr><td colSpan={cols.length} style={{ padding: 12, color: "var(--muted)" }}>No rows match the current filters.</td></tr>
            ) : shown.map((r, i) => (
              <tr key={i}>{cols.map((c) => <td key={c}>{fmtValue(c, r[c])}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RawJson({ data, open }: { data: any; open?: boolean }) {
  return (
    <details className={styles.raw} open={open}>
      <summary>View raw response</summary>
      <pre className={styles.pre}>{safeJson(data)}</pre>
    </details>
  );
}

function ResultView({ data, title }: { data: any; title: string }) {
  const type = detectType(data);
  if (type === "status") return (<div>{<StatusCard data={data} />}<RawJson data={data} /></div>);
  if (type === "detail") return (<div>{<DetailCard data={data} />}<RawJson data={data} /></div>);
  if (type === "table") {
    const records = recordsFrom(data) || [];
    return (<div>{<DataTable records={records} title={title} />}<RawJson data={data} /></div>);
  }
  return <RawJson data={data} open />;
}

/* ------------------------------------------------------------- demo seed */
const DEMO_PANELS: SeedPanel[] = [
  {
    uid: "demo1", apiName: "Refinance Application-Level Index API", opId: "getRaliAllWeeks", opLabel: "Get all weeks (2004-present)", method: "GET", params: {}, status: "done",
    data: [
      { week: "2026-01-02", index: 101.2, refinanceShare: 0.34 },
      { week: "2026-01-09", index: 104.8, refinanceShare: 0.36 },
      { week: "2026-01-16", index: 99.7, refinanceShare: 0.31 },
      { week: "2026-01-23", index: 112.4, refinanceShare: 0.39 },
      { week: "2026-01-30", index: 108.1, refinanceShare: 0.37 },
      { week: "2026-02-06", index: 115.6, refinanceShare: 0.41 },
    ],
  },
  {
    uid: "demo2", apiName: "Connecticut Avenue Securities API", opId: "getCasCurrentReportingPeriod", opLabel: "Current reporting period", method: "GET", params: {}, status: "done",
    data: { currentState: "completed", "reporting-period": "2026-Q1", "state-entry-timestamp": "2026-04-02T09:19:39", "request-id": "6d2c1234-5678-90ab-cdef", s3Uri: "https://s3.amazonaws.com/fnma-cas/2026-q1/loanlevel.csv?X-Amz-Signature=abcd" },
  },
  {
    uid: "demo3", apiName: "Housing and Economic Recovery Act (HERA) API", opId: "getAllNationalFileB", opLabel: "Get all Single-Family Unit-Level Properties", method: "GET", params: { page: "0" }, status: "done",
    data: { links: { next: { href: "/national-file-b/all?page=1" } }, results: { embedded: [
      { enterprise: "Freddie Mac", msaType: "non-metropolitan area", censusTractPctMinority: ">=10, <30%", loanPurpose: "purchase" },
      { enterprise: "Freddie Mac", msaType: "metropolitan area", censusTractPctMinority: "<10%", loanPurpose: "refinance" },
      { enterprise: "Fannie Mae", msaType: "metropolitan area", censusTractPctMinority: ">=30, <100%", loanPurpose: "purchase" },
      { enterprise: "Fannie Mae", msaType: "micropolitan area", censusTractPctMinority: "<10%", loanPurpose: "purchase" },
    ] } },
  },
];

/* -------------------------------------------------------------- workspace */
function encodeWorkspace(panels: Panel[]): string {
  const slim = panels.map((p) => ({ a: p.apiName, o: p.opId, p: p.params }));
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(slim)))); } catch { return ""; }
}
function decodeWorkspace(s: string): { apiName: string; opId: string; params: Record<string, string> }[] {
  try {
    const arr = JSON.parse(decodeURIComponent(escape(atob(s))));
    if (!Array.isArray(arr)) return [];
    return arr.map((x: any) => ({ apiName: String(x.a || ""), opId: String(x.o || ""), params: (x.p && typeof x.p === "object" ? x.p : {}) }));
  } catch { return []; }
}

const SAVED_KEY = "fnma-explorer-saved-v1";
const LAYOUT_KEY = "fnma-explorer-layout-v1";
const MIN_W = 300, MIN_H = 180, DEF_H = 320, PAD = 12, GAP = 16;

const sig = (p: { apiName: string; opId: string; params: Record<string, string> }) =>
  `${p.apiName}|${p.opId}|${JSON.stringify(p.params || {})}`;

function tilePos(index: number, wsW: number): Geom {
  const w = Math.min(480, Math.max(320, wsW - PAD * 2));
  const cols = Math.max(1, Math.floor((wsW - PAD) / (w + GAP)));
  const col = index % cols, row = Math.floor(index / cols);
  return { x: PAD + col * (w + GAP), y: PAD + row * (DEF_H + GAP), w, h: DEF_H };
}
function shortApi(name: string) { return name.replace(/ API$/, ""); }

/* ============================================================= main app */
export default function ExplorerApp() {
  const searchParams = useSearchParams();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState<"businessLine" | "tag">("businessLine");
  const [selectedApiName, setSelectedApiName] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ api: ApiEntry; op: Operation } | null>(null);
  const [composeParams, setComposeParams] = useState<Record<string, string>>({});
  const [panels, setPanels] = useState<Panel[]>([]);
  const [saved, setSaved] = useState<SavedQuery[]>([]);
  const restored = useRef(false);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const panelsRef = useRef<Panel[]>([]);
  const layoutRef = useRef<Record<string, Geom>>({});
  useEffect(() => { panelsRef.current = panels; }, [panels]);

  /* load catalog */
  useEffect(() => {
    fetch("/api/fnma/catalog")
      .then((r) => r.json())
      .then((c: Catalog) => setCatalog(c))
      .catch((e) => setLoadErr(String(e)));
  }, []);

  /* load saved queries + layout */
  useEffect(() => {
    try { const raw = localStorage.getItem(SAVED_KEY); if (raw) setSaved(JSON.parse(raw)); } catch { /* ignore */ }
    try { const raw = localStorage.getItem(LAYOUT_KEY); if (raw) layoutRef.current = JSON.parse(raw) || {}; } catch { /* ignore */ }
  }, []);
  const persistSaved = useCallback((next: SavedQuery[]) => {
    setSaved(next);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);
  const persistLayout = useCallback(() => {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layoutRef.current)); } catch { /* ignore */ }
  }, []);

  const wsWidth = () => workspaceRef.current?.clientWidth || 900;

  /* assign geometry to a list of seed panels (respect saved layout, else tile) */
  const placePanels = useCallback((seeds: SeedPanel[]): Panel[] => {
    const wsW = wsWidth();
    return seeds.map((seed, i) => {
      const g = layoutRef.current[sig(seed)] || tilePos(i, wsW);
      return { ...seed, x: g.x, y: g.y, w: g.w, h: g.h, z: i + 1 };
    });
  }, []);

  /* run a panel against the server */
  const runPanel = useCallback((panel: Panel) => {
    setPanels((ps) => ps.map((p) => (p.uid === panel.uid ? { ...p, status: "loading", error: undefined } : p)));
    fetch("/api/fnma/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_name: panel.apiName, operation_id: panel.opId, params: panel.params }),
    })
      .then((r) => r.json())
      .then((res) => {
        setPanels((ps) => ps.map((p) => p.uid === panel.uid
          ? (res.ok ? { ...p, status: "done", data: res.data, error: undefined } : { ...p, status: "error", error: res.error || "Request failed." })
          : p));
      })
      .catch((e) => setPanels((ps) => ps.map((p) => (p.uid === panel.uid ? { ...p, status: "error", error: String(e) } : p))));
  }, []);

  const addPanel = useCallback((apiName: string, op: { id: string; label: string; method?: string }, params: Record<string, string>) => {
    const seed: SeedPanel = { uid: uid(), apiName, opId: op.id, opLabel: op.label, method: (op.method as any) || "GET", params, status: "loading" };
    const ps = panelsRef.current;
    const wsW = wsWidth();
    const g = layoutRef.current[sig(seed)] || tilePos(ps.length, wsW);
    const z = ps.reduce((m, p) => Math.max(m, p.z), 0) + 1;
    const panel: Panel = { ...seed, x: g.x, y: g.y, w: g.w, h: g.h, z };
    setPanels((prev) => [...prev, panel]);
    runPanel(panel);
  }, [runPanel]);

  /* deep-link / demo restore (once, after catalog is available) */
  useEffect(() => {
    if (restored.current || !catalog) return;
    restored.current = true;
    if (searchParams.get("demo") === "1") { setPanels(placePanels(DEMO_PANELS)); return; }
    const w = searchParams.get("w");
    if (w) {
      const items = decodeWorkspace(w);
      const seeds: SeedPanel[] = items.map((it) => {
        const api = catalog.apis.find((a) => a.name === it.apiName);
        const op = api?.operations?.find((o) => o.id === it.opId);
        return { uid: uid(), apiName: it.apiName, opId: it.opId, opLabel: op?.label || it.opId, method: (op?.method as any) || "GET", params: it.params, status: "loading" };
      });
      const built = placePanels(seeds);
      setPanels(built);
      built.forEach(runPanel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog]);

  /* sync workspace -> URL (op + params; geometry lives in localStorage) */
  useEffect(() => {
    if (!restored.current) return;
    const enc = encodeWorkspace(panels);
    const url = new URL(window.location.href);
    if (enc && panels.length) url.searchParams.set("w", enc); else url.searchParams.delete("w");
    url.searchParams.delete("demo");
    window.history.replaceState(null, "", url.toString());
  }, [panels]);

  /* -------- canvas: bring-to-front, drag, resize, commit, reset -------- */
  const bringToFront = useCallback((uidTarget: string) => {
    setPanels((ps) => {
      const maxZ = ps.reduce((m, p) => Math.max(m, p.z), 0);
      const cur = ps.find((p) => p.uid === uidTarget);
      if (cur && cur.z === maxZ) return ps; // already on top
      return ps.map((p) => (p.uid === uidTarget ? { ...p, z: maxZ + 1 } : p));
    });
  }, []);

  const commitGeom = useCallback((uidTarget: string, partial: Partial<Geom>) => {
    setPanels((ps) => ps.map((p) => {
      if (p.uid !== uidTarget) return p;
      const np = { ...p, ...partial };
      layoutRef.current[sig(np)] = { x: np.x, y: np.y, w: np.w, h: np.h };
      return np;
    }));
    persistLayout();
  }, [persistLayout]);

  const startDrag = useCallback((e: React.PointerEvent, panel: Panel) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-nodrag]")) return; // header tool buttons
    e.preventDefault();
    e.stopPropagation();
    const el = (e.currentTarget as HTMLElement).closest("[data-panel]") as HTMLElement | null;
    if (!el) return;
    bringToFront(panel.uid);
    const startX = e.clientX, startY = e.clientY, origX = panel.x, origY = panel.y;
    let last: Geom = { x: origX, y: origY, w: panel.w, h: panel.h };
    document.body.style.userSelect = "none";
    const move = (ev: PointerEvent) => {
      const nx = Math.max(0, Math.min(origX + (ev.clientX - startX), 6000));
      const ny = Math.max(0, Math.min(origY + (ev.clientY - startY), 6000));
      el.style.left = nx + "px"; el.style.top = ny + "px";
      last = { ...last, x: nx, y: ny };
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
      commitGeom(panel.uid, { x: last.x, y: last.y });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [bringToFront, commitGeom]);

  const startResize = useCallback((e: React.PointerEvent, panel: Panel) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = (e.currentTarget as HTMLElement).closest("[data-panel]") as HTMLElement | null;
    if (!el) return;
    bringToFront(panel.uid);
    const startX = e.clientX, startY = e.clientY, origW = panel.w, origH = panel.h;
    const maxW = Math.max(MIN_W, wsWidth() - 8);
    let last: Geom = { x: panel.x, y: panel.y, w: origW, h: origH };
    document.body.style.userSelect = "none";
    const move = (ev: PointerEvent) => {
      const nw = Math.max(MIN_W, Math.min(origW + (ev.clientX - startX), maxW));
      const nh = Math.max(MIN_H, Math.min(origH + (ev.clientY - startY), 1600));
      el.style.width = nw + "px"; el.style.height = nh + "px";
      last = { ...last, w: nw, h: nh };
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
      commitGeom(panel.uid, { w: last.w, h: last.h });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [bringToFront, commitGeom]);

  const resetLayout = useCallback(() => {
    const wsW = wsWidth();
    setPanels((ps) => ps.map((p, i) => {
      const g = tilePos(i, wsW);
      layoutRef.current[sig(p)] = { x: g.x, y: g.y, w: g.w, h: g.h };
      return { ...p, x: g.x, y: g.y, w: g.w, h: g.h, z: i + 1 };
    }));
    persistLayout();
  }, [persistLayout]);

  /* -------- selection -------- */
  const selectApi = (api: ApiEntry) => {
    if (!api.implemented) return;
    setSelectedApiName(api.name);
    if (selected && selected.api.name !== api.name) setSelected(null);
  };
  const selectOp = (api: ApiEntry, op: Operation) => {
    setSelected({ api, op });
    const seed: Record<string, string> = {};
    for (const p of op.params) if (!p.optional) seed[p.name] = String(p.example ?? "");
    setComposeParams(seed);
  };

  const runCompose = () => { if (selected) addPanel(selected.api.name, selected.op, { ...composeParams }); };
  const saveCompose = () => {
    if (!selected) return;
    const item: SavedQuery = { id: uid(), name: `${shortApi(selected.api.name)} · ${selected.op.label}`, apiName: selected.api.name, opId: selected.op.id, opLabel: selected.op.label, params: { ...composeParams } };
    persistSaved([item, ...saved.filter((s) => !(s.opId === item.opId && JSON.stringify(s.params) === JSON.stringify(item.params)))]);
  };
  const runSaved = (q: SavedQuery) => addPanel(q.apiName, { id: q.opId, label: q.opLabel }, { ...q.params });
  const starPanel = (panel: Panel) => {
    const item: SavedQuery = { id: uid(), name: `${shortApi(panel.apiName)} · ${panel.opLabel}`, apiName: panel.apiName, opId: panel.opId, opLabel: panel.opLabel, params: panel.params };
    persistSaved([item, ...saved.filter((s) => !(s.opId === item.opId && JSON.stringify(s.params) === JSON.stringify(item.params)))]);
  };

  /* -------- derived -------- */
  const filteredApis = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    return catalog.apis.filter((a) => !q || [a.name, a.description, a.tag, a.businessLine].some((v) => String(v).toLowerCase().includes(q)));
  }, [catalog, query]);

  const groups = useMemo(() => {
    if (!catalog) return [] as { key: string; apis: ApiEntry[] }[];
    const keyOf = (a: ApiEntry) => (groupBy === "businessLine" ? a.businessLine : a.tag);
    const order = groupBy === "businessLine" ? catalog.businessLineOrder : [...new Set(catalog.apis.map((a) => a.tag))];
    const seen = [...new Set(filteredApis.map(keyOf))];
    const keys = [...order.filter((k) => seen.includes(k)), ...seen.filter((k) => !order.includes(k))];
    return keys.map((key) => ({ key, apis: filteredApis.filter((a) => keyOf(a) === key) })).filter((g) => g.apis.length);
  }, [catalog, filteredApis, groupBy]);

  const selectedApi = useMemo(() => catalog?.apis.find((a) => a.name === selectedApiName) || null, [catalog, selectedApiName]);
  const liveCount = catalog?.apis.filter((a) => a.implemented && a.status !== "unreachable").length ?? 0;

  const canvasW = panels.length ? Math.max(...panels.map((p) => p.x + p.w)) + 40 : 0;
  const canvasH = panels.length ? Math.max(...panels.map((p) => p.y + p.h)) + 40 : 0;

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <div className={styles.brand}>
          <h1>Fannie Mae API Explorer</h1>
          <span className={styles.sub}>standalone workspace</span>
        </div>
        <div className={styles["head-actions"]}>
          <span className={styles["head-stat"]}>{catalog ? `${catalog.apis.length} APIs · ${liveCount} live` : "loading…"}</span>
          {panels.length > 0 && <button className={styles["head-btn"]} onClick={() => copy(window.location.href)}>Copy share link</button>}
          {panels.length > 0 && <button className={styles["head-btn"]} onClick={() => setPanels([])}>Clear board</button>}
        </div>
      </header>

      {/* PANE 1 — API discovery */}
      <aside className={styles.apis}>
        <div className={styles["pane-inner"]}>
          <input className={styles.search} placeholder="Search APIs…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className={styles.seg}>
            <button className={groupBy === "businessLine" ? styles.on : ""} onClick={() => setGroupBy("businessLine")}>Business line</button>
            <button className={groupBy === "tag" ? styles.on : ""} onClick={() => setGroupBy("tag")}>Function</button>
          </div>

          {loadErr && <div className={styles["empty-note"]} style={{ color: "var(--breach)" }}>Couldn&apos;t load catalog: {loadErr}</div>}

          {groups.map((g) => (
            <div key={g.key}>
              <div className={styles.grouplab}>{g.key} ({g.apis.length})</div>
              {g.apis.map((api) => {
                const state = !api.implemented ? "static" : api.status === "unreachable" ? "down" : "live";
                const isSel = selectedApiName === api.name;
                return (
                  <button
                    key={api.name}
                    className={`${styles.apibtn} ${styles[state]} ${isSel ? styles.sel : ""}`}
                    onClick={() => selectApi(api)}
                    disabled={!api.implemented}
                  >
                    <div className={styles.an}>{api.name}</div>
                    <div className={styles.ad}>{api.description}</div>
                    <span className={`${styles.apill} ${styles[state]}`}>{state === "live" ? "Live" : state === "down" ? "Unreachable" : "Catalog only"}</span>
                  </button>
                );
              })}
            </div>
          ))}

          <div className={styles.grouplab} style={{ marginTop: 16 }}>Saved queries</div>
          {saved.length === 0 ? (
            <div className={styles["empty-note"]}>Compose an operation and hit <b>Save</b> to pin it here. Saved queries persist in this browser.</div>
          ) : saved.map((q) => (
            <div key={q.id} className={styles["saved-row"]}>
              <button className={styles["saved-run"]} title={q.name} onClick={() => runSaved(q)}>{q.name}</button>
              <button className={styles["saved-del"]} title="Remove" onClick={() => persistSaved(saved.filter((s) => s.id !== q.id))}>&times;</button>
            </div>
          ))}
        </div>
      </aside>

      {/* PANE 2 — endpoint navigator */}
      <nav className={styles.endpoints}>
        {!selectedApi ? (
          <div className={styles["ep-empty"]}>Select an API on the left to see its endpoints.</div>
        ) : (
          <>
            <div className={styles["ep-head"]}>
              <div className={styles["ep-title"]}>{shortApi(selectedApi.name)}</div>
              <div className={styles["ep-sub"]}>Endpoints ({(selectedApi.operations || []).length})</div>
              {selectedApi.status === "unreachable" && <div className={styles["ep-warn"]}>Upstream unreachable — calls will return an error.</div>}
            </div>
            <div className={styles["ep-list"]}>
              {(selectedApi.operations || []).length === 0 ? (
                <div className={styles["empty-note"]} style={{ padding: 12 }}>This API is catalog-only — no runnable endpoints.</div>
              ) : (selectedApi.operations || []).map((op) => {
                const on = selected?.op.id === op.id && selected?.api.name === selectedApi.name;
                const method = (op.method || "GET").toUpperCase();
                return (
                  <button key={op.id} className={`${styles["ep-row"]} ${on ? styles["ep-on"] : ""}`} onClick={() => selectOp(selectedApi, op)}>
                    <span className={`${styles["ep-method"]} ${method === "POST" ? styles.post : ""}`}>{method}</span>
                    <span className={styles["ep-text"]}>
                      <span className={styles["ep-name"]}>{op.label}</span>
                      {op.note && <span className={styles["ep-desc"]}>{op.note}</span>}
                      {op.params.length > 0 && <span className={styles["ep-params-hint"]}>{op.params.map((p) => p.name).join(", ")}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </nav>

      {/* PANE 3 — request config + result workspace */}
      <main className={styles.main}>
        {selected && (
          <div className={styles.compose}>
            <div className={styles["compose-hd"]}>
              <span className={styles.verb + (selected.op.method === "POST" ? " " + styles.post : "")}>{selected.op.method || "GET"}</span>
              <span className={styles.capi}>{selected.api.name}</span>
              <span className={styles.cop}>{selected.op.label}</span>
            </div>
            {selected.op.note && <div className={styles["compose-note"]}>{selected.op.note}</div>}
            <div className={styles.pgrid}>
              {selected.op.params.length === 0 && <div className={styles.phint}>No parameters — just run it.</div>}
              {selected.op.params.map((p) => (
                <div key={p.name} className={styles.pfield}>
                  <label>{p.name}{p.optional ? <span className={styles.opt}> optional</span> : null}{p.kind === "itemList" ? <span className={styles.opt}> ({(p.fields || []).join(" / ")})</span> : null}</label>
                  {p.kind === "itemList" ? (
                    <textarea value={composeParams[p.name] ?? ""} placeholder={String(p.example ?? "")} onChange={(e) => setComposeParams((c) => ({ ...c, [p.name]: e.target.value }))} />
                  ) : (
                    <input value={composeParams[p.name] ?? ""} placeholder={String(p.example ?? "")} onChange={(e) => setComposeParams((c) => ({ ...c, [p.name]: e.target.value }))} />
                  )}
                  {p.hint && <span className={styles.phint}>{p.hint}</span>}
                </div>
              ))}
            </div>
            <div className={styles["compose-actions"]}>
              <button className={styles.btn} onClick={runCompose}>Run → add panel</button>
              <button className={`${styles.btn} ${styles.ghost}`} onClick={saveCompose}>Save query</button>
            </div>
          </div>
        )}

        <div className={styles["dash-hd"]}>
          <div className={styles["dash-title"]}>Workspace {panels.length > 0 ? `(${panels.length})` : ""}</div>
          {panels.length > 0 && <button className={styles.mini} onClick={resetLayout}>Reset layout</button>}
        </div>

        <div className={styles.workspace} ref={workspaceRef}>
          {panels.length === 0 ? (
            <div className={styles.blank}>
              <h2>Build a workspace</h2>
              <p>Pick an API, choose an endpoint, and run it — each run becomes a panel on this canvas. Drag panels by their header, resize from the bottom-right corner, and the <b>share link</b> re-opens this exact board.</p>
            </div>
          ) : (
            <div className={styles.canvas} style={{ width: canvasW, height: canvasH }}>
              {panels.map((panel) => (
                <section
                  key={panel.uid}
                  data-panel
                  className={styles.panel}
                  style={{ left: panel.x, top: panel.y, width: panel.w, height: panel.h, zIndex: panel.z }}
                  onPointerDown={() => bringToFront(panel.uid)}
                >
                  <div className={styles["panel-hd"]} onPointerDown={(e) => startDrag(e, panel)}>
                    <div className={styles.pt}>
                      <div className={styles.papi}>{shortApi(panel.apiName)}</div>
                      <div className={styles.plabel}>{panel.opLabel}</div>
                      {Object.keys(panel.params).length > 0 && (
                        <div className={styles.pparams}>{Object.entries(panel.params).filter(([, v]) => v !== "").map(([k, v]) => `${k}=${truncate(v, 24)}`).join("  ")}</div>
                      )}
                    </div>
                    <div className={styles["panel-tools"]} data-nodrag>
                      <button className={styles.ptool} title="Re-run" onClick={() => runPanel(panel)}>↻</button>
                      <button className={styles.ptool} title="Save query" onClick={() => starPanel(panel)}>☆</button>
                      <button className={`${styles.ptool} ${styles.danger}`} title="Remove" onClick={() => setPanels((ps) => ps.filter((p) => p.uid !== panel.uid))}>&times;</button>
                    </div>
                  </div>
                  <div className={styles["panel-body"]}>
                    {panel.status === "loading" && <div className={styles["panel-loading"]}>Running…</div>}
                    {panel.status === "error" && <div className={styles["panel-error"]}>{panel.error}</div>}
                    {panel.status === "done" && <ResultView data={panel.data} title={`${panel.opId}`} />}
                  </div>
                  <div className={styles["resize-handle"]} title="Drag to resize" onPointerDown={(e) => startResize(e, panel)} aria-hidden="true" />
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
