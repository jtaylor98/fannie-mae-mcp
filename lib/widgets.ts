import { z } from "zod";
import { API_CATALOG, runOperation } from "./fanniemae";
import { OPERATION_PARAMS, BATCH_ENCODING_NOTE } from "./operation-params";
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
  server.registerTool(
    "fnma_show_catalog",
    {
      title: "Show the Fannie Mae API catalog (overview)",
      description:
        "Render all 16 Fannie Mae public APIs as grouped cards -- what each " +
        "contains, and which are live (clickable) vs catalog-only. Cards can " +
        "be grouped by business line (Single Family / Multifamily / Both / " +
        "Market & Reference) or by function. Use for " +
        "'what Fannie Mae APIs are there', 'show me the catalog', or a " +
        "general overview request. No parameters, no network call.",
      inputSchema: {},
      _meta: { ui: { resourceUri: widgetUri("catalog") } },
    },
    async () => {
      return {
        content: [{ type: "text", text: `Rendered the Fannie Mae API catalog (${API_CATALOG.length} APIs). Don't restate the list.` }],
        structuredContent: { apis: API_CATALOG.map(withBusinessLine), businessLineOrder: BUSINESS_LINE_ORDER, explorerUrl: explorerUrl() },
        _meta: { ui: { resourceUri: widgetUri("catalog") } },
      };
    }
  );

  server.registerTool(
    "fnma_show_api_detail",
    {
      title: "Show one Fannie Mae API's details (and optionally run an operation)",
      description:
        "Render one specific Fannie Mae API's details as a widget: description " +
        "and, if implemented, its available operations with inline execution. " +
        "Pass api_name matching a name from fnma_show_catalog. To actually run " +
        "a live operation, also pass operation_id and whichever of the other " +
        "params that specific operation needs (see the operation's own params " +
        "list from a prior fnma_show_api_detail call, or list_apis). " +
        BATCH_ENCODING_NOTE,
      inputSchema: {
        api_name: z.string().describe("Exact API name from the catalog, e.g. 'Loan Limits API'"),
        operation_id: z.string().optional().describe("Operation id to execute. Omit to just show the API's details without running anything."),
        ...OPERATION_PARAMS,
      },
      _meta: { ui: { resourceUri: widgetUri("api-detail") } },
    },
    async ({ api_name, operation_id, ...params }: { api_name: string; operation_id?: string; [key: string]: any }) => {
      const entry = API_CATALOG.find((a) => a.name.toLowerCase() === api_name.toLowerCase());
      if (!entry) {
        return {
          content: [{ type: "text", text: `No API found matching "${api_name}". Check fnma_show_catalog for exact names.` }],
          isError: true,
        };
      }

      let lastResult: { operationId: string; data: any } | null = null;
      if (operation_id && entry.implemented) {
        const data = await runOperation(operation_id, params as Record<string, any>);
        lastResult = { operationId: operation_id, data };
      }

      const payload = { ...withBusinessLine(entry), lastResult };

      return {
        content: [
          {
            type: "text",
            text: lastResult
              ? `Ran ${operation_id} on ${entry.name}. Result is shown in the widget -- don't restate it.`
              : `Showing details for ${entry.name}. Don't restate them.`,
          },
        ],
        structuredContent: payload,
        _meta: { ui: { resourceUri: widgetUri("api-detail") } },
      };
    }
  );

  // --- NEW: docked fullscreen Explorer (additive; does not affect the catalog) ---
  // Renders widget/catalog-explorer.html as a large, docked, in-conversation
  // workspace (APIs | Endpoints | compose + tabbed results). Same data as
  // fnma_show_catalog; runs operations through the existing call_fnma_api tool.
  // Fullscreen is still gated by Claude client bug anthropics/claude-ai-mcp#636
  // for remote transports, so today it renders inline; the docked fullscreen
  // path lights up when that client bug clears.
  server.registerTool(
    "fnma_show_explorer",
    {
      title: "Open the Fannie Mae API Explorer (fullscreen workspace)",
      description:
        "Open the Fannie Mae API catalog as a large, docked, in-conversation " +
        "workspace: browse APIs, pick an endpoint, run it live, and view results " +
        "as tabs (table/chart/filters/CSV). Same data as fnma_show_catalog; use " +
        "when the user wants a bigger, explorer-style surface. No parameters.",
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

  // --- NEW: Business Dashboard (additive; business-user, task-oriented surface) ---
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
        "surface (as opposed to the API-oriented catalog/Explorer). V1 workflow " +
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
    "Fannie Mae catalog widget",
    widgetUri("catalog"),
    { title: "Fannie Mae API catalog", mimeType: APP_MIME },
    async () => ({ contents: [{ uri: widgetUri("catalog"), mimeType: APP_MIME, text: widgetHtml("catalog"), _meta: APP_UI_META }] })
  );

  server.registerResource(
    "Fannie Mae API detail widget",
    widgetUri("api-detail"),
    { title: "Fannie Mae API detail", mimeType: APP_MIME },
    async () => ({ contents: [{ uri: widgetUri("api-detail"), mimeType: APP_MIME, text: widgetHtml("api-detail"), _meta: APP_UI_META }] })
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
