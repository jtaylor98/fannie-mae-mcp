const TOKEN_URL = () => requireEnv("FANNIE_TOKEN_URL");
const API_BASE = "https://api.fanniemae.com";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = requireEnv("FANNIE_CLIENT_ID");
  const clientSecret = requireEnv("FANNIE_CLIENT_SECRET");
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(TOKEN_URL(), {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`Fannie Mae token request failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 60_000,
  };
  return cachedToken.token;
}

// NOTE: Fannie Mae's public-API gateway does NOT use standard OAuth Bearer
// auth for the resource calls themselves -- despite issuing a normal-looking
// JWT, the actual data API expects that token in a custom
// `x-public-access-token` header instead of `Authorization: Bearer`.
// Confirmed via direct curl testing.
async function fannieGet(path: string): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "x-public-access-token": token,
    },
  });

  if (!res.ok) {
    throw new Error(`Fannie Mae API error ${res.status} on ${path}: ${await res.text()}`);
  }

  return res.json();
}

export async function getAllLoanLimits() {
  return fannieGet("/v1/loan-limits/all");
}

export async function getHistoricalLoanLimits(year: number) {
  return fannieGet(`/v1/loan-limits/historical/${year}`);
}

export async function getLoanLimitsByCounty(state: string, county: string) {
  return fannieGet(`/v1/loan-limits/state/${state}/county/${county}`);
}

export interface ApiOperationParam {
  name: string;
  type: "string" | "number";
  example: string | number;
}

export interface ApiOperation {
  id: string;
  label: string;
  params: ApiOperationParam[];
}

export interface ApiCatalogEntry {
  name: string;
  tag: string;
  description: string;
  implemented?: boolean;
  operations?: ApiOperation[];
}

export const API_CATALOG: ApiCatalogEntry[] = [
  { name: "Connecticut Avenue Securities API", tag: "Pricing & Execution", description: "Provides loan level data underlying Single-Family Connecticut Avenue Securities (CAS) deals." },
  { name: "Construction Spending API", tag: "Originating & Underwriting", description: "Monthly estimates of the total dollar value of construction work done in the U.S." },
  { name: "Credit Insurance Risk Transfer API", tag: "Pricing & Execution", description: "Provides loan level data underlying Single-Family Credit Insurance Risk Transfer (CIRT) deals." },
  { name: "Economic Indicators API", tag: "Originating & Underwriting", description: "Analysis of current and historical data for the economic forecast." },
  { name: "Gateway Services Public API", tag: "Servicing", description: "Public API swagger for Gateway Services." },
  { name: "Housing and Economic Recovery Act (HERA) API", tag: "Originating & Underwriting", description: "Public Use Database -- HERA API." },
  { name: "Housing Indicators API", tag: "Originating & Underwriting", description: "Analysis of current and historical data for the housing forecast." },
  { name: "Income Limits API", tag: "Originating & Underwriting", description: "Income Limits for HomeReady(R) and other AMI-based loan products." },
  {
    name: "Loan Limits API",
    tag: "Originating & Underwriting",
    description: "Loan limits data for US territories and counties.",
    implemented: true,
    operations: [
      { id: "getAllLoanLimits", label: "Get all loan limits", params: [] },
      { id: "getHistoricalLoanLimits", label: "Get historical loan limits by year", params: [{ name: "year", type: "number", example: 2015 }] },
      { id: "getLoanLimitsByCounty", label: "Get loan limits by state + county", params: [{ name: "state", type: "string", example: "CA" }, { name: "county", type: "string", example: "Los Angeles" }] },
    ],
  },
  { name: "Manufactured Housing Loans API", tag: "Single Family", description: "Manufactured Housing Loan data including search by specification, acquisition data, performance data." },
  { name: "National Housing Survey API", tag: "Originating & Underwriting", description: "National Housing Survey (NHS) Data." },
  { name: "Opportunity Zones API", tag: "Originating & Underwriting", description: "Opportunity Zones for United States and its territories." },
  { name: "Pool Prefix API", tag: "Pricing & Execution", description: "Get pool prefix data by amortization type and/or property type and/or pool prefix." },
  { name: "Refinance Application-Level Index API", tag: "Servicing", description: "Refinance Application-Level Index data." },
  { name: "Re-Performing Loans API", tag: "Pricing & Execution", description: "Performance of Fannie Mae single-family mortgage loans that were permanently modified." },
  { name: "Single-Family Loan Performance History API", tag: "Single Family", description: "Single-Family Loan Performance History." },
];

/** Dispatches a named operation (from an implemented API's `operations` list) to the real function that executes it. */
export async function runOperation(operationId: string, params: Record<string, string | number>): Promise<any> {
  switch (operationId) {
    case "getAllLoanLimits":
      return getAllLoanLimits();
    case "getHistoricalLoanLimits":
      return getHistoricalLoanLimits(Number(params.year));
    case "getLoanLimitsByCounty":
      return getLoanLimitsByCounty(String(params.state), String(params.county));
    default:
      throw new Error(`Unknown operation: ${operationId}`);
  }
}
