import { z } from "zod";
import { API_CATALOG, runOperation } from "./fanniemae";
import { WIDGETS } from "../app/_widgets.js";

const APP_MIME = "text/html;profile=mcp-app";
const widgetUri = (name: string) => `ui://fnma/${name}.html`;
const widgetHtml = (name: string) =>
  Buffer.from((WIDGETS as Record<string, string>)[name], "base64").toString("utf8");

export function registerWidgets(server: any) {
  server.registerTool(
    "fnma_show_catalog",
    {
      title: "Show the Fannie Mae API catalog (overview)",
      description:
        "Render all 16 Fannie Mae public APIs as grouped cards -- what each " +
        "contains, and which are live (clickable) vs catalog-only. Use for " +
        "'what Fannie Mae APIs are there', 'show me the catalog', or a " +
        "general overview request. No parameters, no network call.",
      inputSchema: {},
      _meta: { ui: { resourceUri: widgetUri("catalog") } },
    },
    async () => {
      return {
        content: [{ type: "text", text: `Rendered the Fannie Mae API catalog (${API_CATALOG.length} APIs). Don't restate the list.` }],
        structuredContent: { apis: API_CATALOG },
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
        "a live operation (e.g. after the user fills in params and clicks Run " +
        "in the widget, or asks to run one directly), also pass operation_id " +
        "and the relevant params (state, county, or year) -- this executes the " +
        "real API call and includes the result in the same widget.",
      inputSchema: {
        api_name: z.string().describe("Exact API name from the catalog, e.g. 'Loan Limits API'"),
        operation_id: z.string().optional().describe("Operation id to execute, e.g. 'getLoanLimitsByCounty'. Omit to just show the API's details without running anything."),
        state: z.string().optional().describe("State/territory code, for operations that need it"),
        county: z.string().optional().describe("County name, for operations that need it"),
        year: z.number().optional().describe("Calendar year, for operations that need it"),
      },
      _meta: { ui: { resourceUri: widgetUri("api-detail") } },
    },
    async ({ api_name, operation_id, state, county, year }: { api_name: string; operation_id?: string; state?: string; county?: string; year?: number }) => {
      const entry = API_CATALOG.find((a) => a.name.toLowerCase() === api_name.toLowerCase());
      if (!entry) {
        return {
          content: [{ type: "text", text: `No API found matching "${api_name}". Check fnma_show_catalog for exact names.` }],
          isError: true,
        };
      }

      let lastResult: { operationId: string; data: any } | null = null;
      if (operation_id && entry.implemented) {
        const data = await runOperation(operation_id, { state, county, year } as Record<string, string | number>);
        lastResult = { operationId: operation_id, data };
      }

      const payload = { ...entry, lastResult };

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

  server.registerResource(
    "Fannie Mae catalog widget",
    widgetUri("catalog"),
    { title: "Fannie Mae API catalog", mimeType: APP_MIME },
    async () => ({ contents: [{ uri: widgetUri("catalog"), mimeType: APP_MIME, text: widgetHtml("catalog") }] })
  );

  server.registerResource(
    "Fannie Mae API detail widget",
    widgetUri("api-detail"),
    { title: "Fannie Mae API detail", mimeType: APP_MIME },
    async () => ({ contents: [{ uri: widgetUri("api-detail"), mimeType: APP_MIME, text: widgetHtml("api-detail") }] })
  );
}
