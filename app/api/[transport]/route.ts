import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { API_CATALOG, runOperation } from "@/lib/fanniemae";
import { registerWidgets } from "@/lib/widgets";

export const dynamic = "force-dynamic";

const handler = createMcpHandler(
  async (server) => {
    server.tool(
      "list_apis",
      "List Fannie Mae's public APIs available through this connector, with a short description of each and which are live vs catalog-only.",
      {},
      async () => {
        return { content: [{ type: "text", text: JSON.stringify(API_CATALOG, null, 2) }] };
      }
    );

    server.tool(
      "call_fnma_api",
      "Directly call a Fannie Mae API operation and get plain JSON back -- no widget is rendered. " +
        "Use this instead of fnma_show_api_detail when the user explicitly wants raw data/text " +
        "rather than the visual catalog, or on a surface that can't render widgets. Pass api_name " +
        "(exact name from list_apis) and operation_id, plus whichever params that operation needs.",
      {
        api_name: z.string().describe("Exact API name, e.g. 'Loan Limits API'"),
        operation_id: z.string().describe("Operation id, e.g. 'getLoanLimitsByCounty'"),
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
        id: z.string().optional(),
      },
      async ({ api_name, operation_id, ...params }) => {
        const entry = API_CATALOG.find((a) => a.name.toLowerCase() === api_name.toLowerCase());
        if (!entry) {
          return {
            content: [{ type: "text", text: `No API found matching "${api_name}". Check list_apis for exact names.` }],
            isError: true,
          };
        }
        if (!entry.implemented) {
          return {
            content: [{ type: "text", text: `"${entry.name}" is catalog-only, not wired to live data yet.` }],
            isError: true,
          };
        }

        const data = await runOperation(operation_id, params as Record<string, string | number>);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
    );

    // Widget tools (fnma_show_catalog, fnma_show_api_detail) cover the same
    // 14 APIs visually. call_fnma_api above is the plain-text-only escape
    // hatch for when a widget isn't wanted or can't render.
    registerWidgets(server);
  },
  {},
  {
    basePath: "/api",
    verboseLogs: true,
  }
);

export { handler as GET, handler as POST, handler as DELETE };
