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
        "a live operation, also pass operation_id and whichever of the other " +
        "params that specific operation needs (see the operation's own params " +
        "list from a prior fnma_show_api_detail call, or list_apis).",
      inputSchema: {
        api_name: z.string().describe("Exact API name from the catalog, e.g. 'Loan Limits API'"),
        operation_id: z.string().optional().describe("Operation id to execute. Omit to just show the API's details without running anything."),
        state: z.string().optional(),
        county: z.string().optional(),
        year: z.number().optional(),
        month: z.number().optional(),
        quarter: z.string().optional(),
        fips_code: z.string().optional(),
        number: z.string().optional(),
        street: z.string().optional(),
        city: z.string().optional(),
        zip: z.string().optional(),
        indicator: z.string().optional(),
        page: z.string().optional(),
        section: z.string().optional(),
        sector: z.string().optional(),
        subsector: z.string().optional(),
        id: z.string().optional(),
        areatype: z.string().optional(),
        ownershipstatus: z.string().optional(),
        housingcostratio: z.string().optional(),
        agegp: z.string().optional(),
        censusregion: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
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
        const data = await runOperation(operation_id, params as Record<string, string | number>);
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
