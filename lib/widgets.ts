import { API_CATALOG } from "./fanniemae";
import { withBusinessLine, BUSINESS_LINE_ORDER } from "./business-line";
import { WIDGETS } from "../app/_widgets.js";

const APP_MIME = "text/html;profile=mcp-app";
const widgetUri = (name: string) => `ui://fnma/${name}.html`;
const widgetHtml = (name: string) =>
  Buffer.from((WIDGETS as Record<string, string>)[name], "base64").toString("utf8");

// Minimal _meta.ui so Claude sees these as *declared* MCP Apps rather than bare
// inline tool-result widgets -- an experiment to check whether that declaration
// is what earns the host's expand/fullscreen affordance (a working remote app,
// Connectry's cockpit, gets an expand control here; ours currently doesn't).
// Kept intentionally minimal: NO `csp` (these widgets are styled with inline
// <style>, run an inline <script>, and use data: URLs -- declaring a partial CSP
// would block all of that and break the inline render that currently works) and
// NO `domain` (it's a host-computed signed subdomain; a wrong value breaks
// rendering). Escalate to those only if prefersBorder-presence alone doesn't
// surface the expand control.
const APP_UI_META = { ui: { prefersBorder: true } };

/**
 * Absolute URL of the standalone Explorer app, for the widget's "Open full app"
 * button. A sandboxed ui:// widget can't resolve a relative link or know the
 * deployment origin itself, so the server injects it. Prefers an explicit
 * override, then Vercel's stable production domain, then the current
 * deployment. Null when none is set (e.g. local dev) -- the widget then simply
 * omits the button.
 */
function explorerUrl(): string | null {
  const base =
    process.env.EXPLORER_BASE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/explorer`;
}

export function registerWidgets(server: any) {
  // --- API Explorer: the single browse-and-run surface for developers/admins ---
  // Renders widget/catalog-explorer.html. Opens to the catalog GALLERY (grouped
  // cards of every API) as its front door and drills into a docked 3-pane
  // workspace (APIs | Endpoints | compose + tabbed results) per API. This
  // absorbed the standalone Catalog, which was retired 2026-08-11 (the old
  // fnma_show_catalog / fnma_show_api_detail tools + widgets/catalog.html +
  // widget/api-detail.html were removed). See
  // claude/fnma-surface-consolidation-eval.md. Operations run through the
  // existing call_fnma_api tool.
  server.registerTool(
    "fnma_show_explorer",
    {
      title: "Show the Fannie Mae API catalog / Explorer (browse + run every API)",
      description:
        "Open the Fannie Mae API Explorer: the single surface for browsing and " +
        "running all 16 Fannie Mae public APIs. Opens to a catalog gallery -- " +
        "grouped cards of every API with descriptions, business line, and status " +
        "(live / unreachable / catalog-only) -- as its front door; click any live " +
        "API to drill into a docked workspace to pick an endpoint, run it live, and " +
        "view results as tabs (table/chart/filters/CSV). Use for 'what Fannie Mae " +
        "APIs are there', 'show me the (API) catalog', a general overview, or any " +
        "request to browse or run a specific API. No parameters.",
      inputSchema: {},
      _meta: { ui: { resourceUri: widgetUri("catalog-explorer") } },
    },
    async () => {
      return {
        content: [{ type: "text", text: `Opened the Fannie Mae API Explorer (${API_CATALOG.length} APIs). Don't restate the list.` }],
        structuredContent: {
          apis: API_CATALOG.map(withBusinessLine),
          businessLineOrder: BUSINESS_LINE_ORDER,
          explorerUrl: explorerUrl(),
        },
        _meta: { ui: { resourceUri: widgetUri("catalog-explorer") } },
      };
    }
  );

  // --- Business Dashboard (business-user, task-oriented surface) ---
  // Renders widget/dashboard.html: a "What would you like to do?" workflow launcher.
  // V1 workflow "Property & Loan Snapshot" takes a property address and shows the
  // applicable conforming loan limit, HomeReady income limit, and Opportunity Zone
  // designation (with optional deal-detail comparisons). It runs the underlying
  // operations live through the existing call_fnma_api tool; the server only needs
  // to inject explorerUrl for the "Open the API Explorer" escape hatch.
  server.registerTool(
    "fnma_show_dashboard",
    {
      title: "Open the Fannie Mae Business Dashboard (task-oriented, business users)",
      description:
        "Open the Fannie Mae Business Dashboard: a business-user, task-oriented " +
        "surface (as opposed to the API-oriented Explorer). V1 workflow " +
        "'Property & Loan Snapshot' takes a property address and shows the " +
        "applicable conforming loan limit, HomeReady income limit, and Opportunity " +
        "Zone designation for that location, with optional comparison against " +
        "deal details (qualifying income, loan amount, units). Use for " +
        "business-user requests like 'business dashboard', 'property/loan " +
        "snapshot', or 'what's the loan limit / income limit / opportunity-zone " +
        "status for <address>'. No parameters.",
      inputSchema: {},
      _meta: { ui: { resourceUri: widgetUri("dashboard") } },
    },
    async () => {
      return {
        content: [{ type: "text", text: `Opened the Fannie Mae Business Dashboard. Don't restate its contents.` }],
        structuredContent: { explorerUrl: explorerUrl() },
        _meta: { ui: { resourceUri: widgetUri("dashboard") } },
      };
    }
  );

  server.registerResource(
    "Fannie Mae API Explorer widget",
    widgetUri("catalog-explorer"),
    { title: "Fannie Mae API Explorer", mimeType: APP_MIME },
    async () => ({ contents: [{ uri: widgetUri("catalog-explorer"), mimeType: APP_MIME, text: widgetHtml("catalog-explorer"), _meta: APP_UI_META }] })
  );

  server.registerResource(
    "Fannie Mae Business Dashboard widget",
    widgetUri("dashboard"),
    { title: "Fannie Mae Business Dashboard", mimeType: APP_MIME },
    async () => ({ contents: [{ uri: widgetUri("dashboard"), mimeType: APP_MIME, text: widgetHtml("dashboard"), _meta: APP_UI_META }] })
  );
}
