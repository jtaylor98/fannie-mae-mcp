import { NextResponse } from "next/server";
import { API_CATALOG, runOperation } from "@/lib/fanniemae";

/**
 * Same-origin run endpoint for the standalone Explorer app.
 *
 * Wraps `runOperation` with the same validation the MCP `call_fnma_api` tool
 * applies (known API, implemented, known operation), so the browser app can
 * execute any live operation without ever seeing the Fannie Mae OAuth
 * credentials -- they stay server-side, and there is no cross-origin hop.
 *
 * Body: { api_name?: string, operation_id: string, params?: Record<string, unknown> }
 * Reply: { ok: true, apiName, operationId, data } | { ok: false, error }
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Request body must be valid JSON." }, { status: 400 });
  }

  const operationId = typeof body?.operation_id === "string" ? body.operation_id : "";
  const apiName = typeof body?.api_name === "string" ? body.api_name : "";
  const params = (body?.params && typeof body.params === "object" ? body.params : {}) as Record<string, any>;

  if (!operationId) {
    return NextResponse.json({ ok: false, error: "operation_id is required." }, { status: 400 });
  }

  // Prefer the named API; otherwise infer it from the operation id.
  let entry = apiName
    ? API_CATALOG.find((a) => a.name.toLowerCase() === apiName.toLowerCase())
    : undefined;
  if (!entry) {
    entry = API_CATALOG.find((a) => (a.operations ?? []).some((o) => o.id === operationId));
  }

  if (!entry) {
    return NextResponse.json(
      { ok: false, error: `No API found for operation "${operationId}".` },
      { status: 404 }
    );
  }
  if (!entry.implemented) {
    return NextResponse.json(
      { ok: false, error: `"${entry.name}" is catalog-only and not wired to live data yet.` },
      { status: 400 }
    );
  }
  const known = new Set((entry.operations ?? []).map((o) => o.id));
  if (!known.has(operationId)) {
    return NextResponse.json(
      { ok: false, error: `"${operationId}" isn't an operation on ${entry.name}.` },
      { status: 400 }
    );
  }

  try {
    const data = await runOperation(operationId, params);
    return NextResponse.json({ ok: true, apiName: entry.name, operationId, data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 502 }
    );
  }
}
