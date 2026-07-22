import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  getAllLoanLimits,
  getHistoricalLoanLimits,
  getLoanLimitsByCounty,
  API_CATALOG,
} from "@/lib/fanniemae";

export const dynamic = "force-dynamic";

const handler = createMcpHandler(async (server) => {
  server.tool(
    "list_apis",
    "List Fannie Mae's public APIs available through this connector, with a short description of each. Only Loan Limits is currently wired up to live data; the rest are catalog entries for browsing.",
    {},
    async () => {
      return { content: [{ type: "text", text: JSON.stringify(API_CATALOG, null, 2) }] };
    }
  );

  server.tool(
    "get_all_loan_limits",
    "Get loan limits for every US county, county equivalent, and territory in a single call.",
    {},
    async () => {
      const data = await getAllLoanLimits();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_historical_loan_limits",
    "Get historical loan limits for all US counties/territories for a given calendar year (2009-2019).",
    { year: z.number().describe("Calendar year, e.g. 2015") },
    async ({ year }) => {
      const data = await getHistoricalLoanLimits(year);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_loan_limits_by_county",
    "Get loan limits for one specific US state/territory and county.",
    {
      state: z.string().describe("State or territory code, e.g. 'CA'"),
      county: z.string().describe("County name, e.g. 'Los Angeles'"),
    },
    async ({ state, county }) => {
      const data = await getLoanLimitsByCounty(state, county);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
});

export { handler as GET, handler as POST, handler as DELETE };
