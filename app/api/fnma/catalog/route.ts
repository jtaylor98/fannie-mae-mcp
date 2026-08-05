import { NextResponse } from "next/server";
import { API_CATALOG } from "@/lib/fanniemae";
import { withBusinessLine, BUSINESS_LINE_ORDER } from "@/lib/business-line";

/**
 * Same-origin catalog feed for the standalone Explorer app.
 *
 * Returns exactly the payload the MCP `fnma_show_catalog` widget consumes
 * (`API_CATALOG.map(withBusinessLine)` + business-line order) so the two
 * surfaces never drift. Pure static data -- no secrets, no upstream call.
 */
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json({
    apis: API_CATALOG.map(withBusinessLine),
    businessLineOrder: BUSINESS_LINE_ORDER,
  });
}
