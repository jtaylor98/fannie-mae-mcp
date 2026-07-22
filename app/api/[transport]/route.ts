import { createMcpHandler } from "mcp-handler";
import { API_CATALOG } from "@/lib/fanniemae";
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

    // All 14 implemented APIs (including what used to be Loan Limits'
    // standalone tools) are now reached exclusively through
    // fnma_show_api_detail's generic api_name + operation_id dispatch --
    // see lib/widgets.ts. This keeps the tool list small and consistent
    // rather than hand-writing a tool per operation per API.
    registerWidgets(server);
  },
  {},
  {
    basePath: "/api",
    verboseLogs: true,
  }
);

export { handler as GET, handler as POST, handler as DELETE };
