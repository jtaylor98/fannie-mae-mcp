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

async function fannieGet(path: string, query?: Record<string, string | number | undefined>): Promise<any> {
  const token = await getAccessToken();
  const qs = query
    ? "?" + Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  const res = await fetch(`${API_BASE}${path}${qs}`, {
    headers: { "x-public-access-token": token },
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

export async function getIncomeLimitsForFipsCode(fips_code: string) {
  return fannieGet("/v1/income-limits/censustracts", { fips_code });
}
export async function getIncomeLimitsByAddress(number: string, street: string, city: string, state: string, zip: string) {
  return fannieGet("/v1/income-limits/addresscheck", { number, street, city, state, zip });
}

export async function validateOpportunityZoneByAddress(number: string, street: string, city: string, state: string, zip: string) {
  return fannieGet("/v1/opportunity-zones/addresscheck", { number, street, city, state, zip });
}
export async function getOpportunityZoneDataForCounty(state: string, county?: string) {
  return fannieGet("/v1/opportunity-zones/censustracts", { state, county });
}

export async function getEconomicIndicatorsByName(indicator: string) {
  return fannieGet(`/v1/economic-forecasts/indicators/${indicator}`);
}
export async function getEconomicIndicatorForYear(year: number) {
  return fannieGet(`/v1/economic-forecasts/data/years/${year}`);
}
export async function getEconomicIndicatorForYearAndMonth(year: number, month: number) {
  return fannieGet(`/v1/economic-forecasts/reports/years/${year}/months/${month}`);
}
export async function getEconomicIndicatorForYearAndQuarter(year: number, quarter: string) {
  return fannieGet(`/v1/economic-forecasts/data/years/${year}/quarters/${quarter}`);
}
export async function getEconomicIndicatorForEffDateForYear(year: number) {
  return fannieGet(`/v1/economic-forecasts/reports/years/${year}`);
}

export async function getHousingIndicatorsByName(indicator: string) {
  return fannieGet(`/v1/housing-indicators/indicators/${indicator}`);
}
export async function getHousingIndicatorForYear(year: number) {
  return fannieGet(`/v1/housing-indicators/data/years/${year}`);
}
export async function getHousingIndicatorForEffDateForYearAndMonth(year: number, month: number) {
  return fannieGet(`/v1/housing-indicators/reports/years/${year}/months/${month}`);
}
export async function getHousingIndicatorForEffDateForYear(year: number) {
  return fannieGet(`/v1/housing-indicators/reports/years/${year}`);
}
export async function getHousingIndicatorForYearAndQuarter(year: number, quarter: string) {
  return fannieGet(`/v1/housing-indicators/data/years/${year}/quarters/${quarter}`);
}

export async function getAllNationalFileB(page?: string) {
  return fannieGet("/v1/national-file-b/all", { page });
}

export async function getConstructionSpendingBySectionAndSector(section: string, sector: string) {
  return fannieGet("/v1/construction-spending/sectionandsector", { section, sector });
}
export async function getConstructionSpendingBySection(section: string) {
  return fannieGet("/v1/construction-spending/section", { section });
}
export async function getConstructionSpendingBySectionSectorAndSubsector(section: string, sector: string, subsector: string) {
  return fannieGet("/v1/construction-spending/sectionsectorandsubsector", { section, sector, subsector });
}

export async function getManufacturedHousingLoan(id: string) {
  return fannieGet(`/v1/manufactured-housing-loans/${id}`);
}
export async function getManufacturedHousingAcquisitions(page?: string) {
  return fannieGet("/v1/manufactured-housing-loans/acquisitions", { page });
}
export async function getManufacturedHousingAcquisitionForId(id: string) {
  return fannieGet(`/v1/manufactured-housing-loans/${id}/acquisition`);
}
export async function getManufacturedHousingPerformance(page?: string) {
  return fannieGet("/v1/manufactured-housing-loans/performance", { page });
}
export async function getManufacturedHousingPerformanceForId(id: string) {
  return fannieGet(`/v1/manufactured-housing-loans/${id}/performance`);
}

export async function getNhsResults() {
  return fannieGet("/v1/nhs/results");
}
export async function getHpsiData() {
  return fannieGet("/v1/nhs/hpsi");
}
export async function getHpsiByAreaType(areatype: string) {
  return fannieGet(`/v1/nhs/hpsi/area-type/${areatype}`);
}
export async function getHpsiByOwnershipStatus(ownershipstatus: string) {
  return fannieGet(`/v1/nhs/hpsi/ownership-status/${ownershipstatus}`);
}
export async function getHpsiByHousingCostRatio(housingcostratio: string) {
  return fannieGet(`/v1/nhs/hpsi/housing-cost-ratio/${housingcostratio}`);
}
export async function getHpsiByAgeGroup(agegp: string) {
  return fannieGet(`/v1/nhs/hpsi/age-groups/${agegp}`);
}
export async function getHpsiByCensusRegion(censusregion: string) {
  return fannieGet(`/v1/nhs/hpsi/census-region/${censusregion}`);
}

export async function getCasCurrentReportingPeriod() {
  return fannieGet("/v1/connecticut-ave-securities/current-reporting-period");
}
export async function getCasProgramToDate() {
  return fannieGet("/v1/connecticut-ave-securities/program-to-date");
}

export async function getCirtProgramToDate() {
  return fannieGet("/v1/credit-insurance-risk-transfer/program-to-date");
}
export async function getCirtCurrentReportingPeriod() {
  return fannieGet("/v1/credit-insurance-risk-transfer/current-reporting-period");
}

export async function getMostRecentRaliWeek() {
  return fannieGet("/v1/rali/most-recent-week");
}
export async function getRaliAllWeeks() {
  return fannieGet("/v1/rali/all-weeks");
}
export async function getRaliByWeekRange(startDate: string, endDate?: string) {
  return fannieGet("/v1/rali/weekly-time-range", { startDate, endDate });
}

export async function getRplPerformanceFile() {
  return fannieGet("/v1/rpl/performance");
}
export async function getRplLoanDetailFile() {
  return fannieGet("/v1/rpl/loan-detail");
}

export async function getLphDataForYearAndQuarter(year: number, quarter: string) {
  return fannieGet(`/v1/sf-loan-performance-data/years/${year}/quarters/${quarter}`);
}
export async function getAllHarpDataset() {
  return fannieGet("/v1/sf-loan-performance-data/harp-dataset");
}
export async function getPrimaryLphDataset() {
  return fannieGet("/v1/sf-loan-performance-data/primary-dataset");
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

const ECON_INDICATORS = ["gross-domestic-product","personal-consumption-expenditures","residential-fixed-investment","business-fixed-investment","government-consumption-and-investment","net-exports","change-in-business-inventories","consumer-price-index","core-consumer-price-index-excl-food-and-energy","personal-chain-expenditures-chain-price-index","core-personal-chain-expenditures-chain-price-index-excl-food-and-energy","unemployment-rate","employment-total-nonfarm","federal-funds-rate","1-year-treasury-note-yield","10-year-treasury-note-yield"];
const HOUSING_INDICATORS = ["total-housing-starts","single-family-1-unit-housing-starts","multifamily-2+units-housing-starts","total-home-sales","new-single-family-home-sales","existing-single-family-condos-coops-home-sales","median-new-home-price","median-existing-home-price","federal-housing-finance-agency-purchase-only-house-price-index","30-year-fixed-rate-mortgage","5-year-adjustable-rate-mortgage","single-family-mortgage-originations","single-family-purchase-mortgage-originations","single-family-refinance-mortgage-originations","refinance-share-of-total-single-family-mortgage-originations"];
const QUARTERS = ["q1", "q2", "q3", "q4", "eoy"];

export const API_CATALOG: ApiCatalogEntry[] = [
  { name: "Connecticut Avenue Securities API", tag: "Pricing & Execution", description: "Provides loan level data underlying Single-Family Connecticut Avenue Securities (CAS) deals.", implemented: true, operations: [{ id: "getCasCurrentReportingPeriod", label: "Current reporting period", params: [] }, { id: "getCasProgramToDate", label: "Full program-to-date dataset", params: [] }] },
  { name: "Construction Spending API", tag: "Originating & Underwriting", description: "Monthly estimates of the total dollar value of construction work done in the U.S.", implemented: true, operations: [
    { id: "getConstructionSpendingBySection", label: "Get by section only", params: [{ name: "section", type: "string", example: "Total" }] },
    { id: "getConstructionSpendingBySectionAndSector", label: "Get by section + sector", params: [{ name: "section", type: "string", example: "Total" }, { name: "sector", type: "string", example: "Residential" }] },
    { id: "getConstructionSpendingBySectionSectorAndSubsector", label: "Get by section + sector + subsector", params: [{ name: "section", type: "string", example: "Private" }, { name: "sector", type: "string", example: "Nonresidential" }, { name: "subsector", type: "string", example: "Office" }] },
  ] },
  { name: "Credit Insurance Risk Transfer API", tag: "Pricing & Execution", description: "Provides loan level data underlying Single-Family Credit Insurance Risk Transfer (CIRT) deals.", implemented: true, operations: [{ id: "getCirtCurrentReportingPeriod", label: "Current reporting period", params: [] }, { id: "getCirtProgramToDate", label: "Full program-to-date dataset", params: [] }] },
  { name: "Economic Indicators API", tag: "Originating & Underwriting", description: "Analysis of current and historical data for the economic forecast.", implemented: true, operations: [
    { id: "getEconomicIndicatorsByName", label: "Get one indicator's full history", params: [{ name: "indicator", type: "string", example: ECON_INDICATORS[0] }] },
    { id: "getEconomicIndicatorForYear", label: "Get all indicators for a year (by data period)", params: [{ name: "year", type: "number", example: 2026 }] },
    { id: "getEconomicIndicatorForYearAndQuarter", label: "Get all indicators for a year + quarter (by data period)", params: [{ name: "year", type: "number", example: 2026 }, { name: "quarter", type: "string", example: "q1" }] },
    { id: "getEconomicIndicatorForYearAndMonth", label: "Get report released in a specific year + month", params: [{ name: "year", type: "number", example: 2026 }, { name: "month", type: "number", example: 5 }] },
    { id: "getEconomicIndicatorForEffDateForYear", label: "Get all reports released in a year", params: [{ name: "year", type: "number", example: 2026 }] },
  ] },
  { name: "Gateway Services Public API", tag: "Servicing", description: "Public API swagger for Gateway Services." },
  { name: "Housing and Economic Recovery Act (HERA) API", tag: "Originating & Underwriting", description: "Public Use Database -- HERA API.", implemented: true, operations: [{ id: "getAllNationalFileB", label: "Get all Single-Family Unit-Level Properties (paginated)", params: [{ name: "page", type: "string", example: "0" }] }] },
  { name: "Housing Indicators API", tag: "Originating & Underwriting", description: "Analysis of current and historical data for the housing forecast.", implemented: true, operations: [
    { id: "getHousingIndicatorsByName", label: "Get one indicator's full history", params: [{ name: "indicator", type: "string", example: HOUSING_INDICATORS[0] }] },
    { id: "getHousingIndicatorForYear", label: "Get all indicators for a year (by data period)", params: [{ name: "year", type: "number", example: 2026 }] },
    { id: "getHousingIndicatorForYearAndQuarter", label: "Get all indicators for a year + quarter (by data period)", params: [{ name: "year", type: "number", example: 2026 }, { name: "quarter", type: "string", example: "q1" }] },
    { id: "getHousingIndicatorForEffDateForYearAndMonth", label: "Get report released in a specific year + month", params: [{ name: "year", type: "number", example: 2026 }, { name: "month", type: "number", example: 5 }] },
    { id: "getHousingIndicatorForEffDateForYear", label: "Get all reports released in a year", params: [{ name: "year", type: "number", example: 2026 }] },
  ] },
  { name: "Income Limits API", tag: "Originating & Underwriting", description: "Income Limits for HomeReady(R) and other AMI-based loan products.", implemented: true, operations: [{ id: "getIncomeLimitsForFipsCode", label: "Get by census tract (FIPS code)", params: [{ name: "fips_code", type: "string", example: "06037101110" }] }, { id: "getIncomeLimitsByAddress", label: "Get by street address", params: [{ name: "number", type: "string", example: "13150" }, { name: "street", type: "string", example: "Worldgate Drive" }, { name: "city", type: "string", example: "Herndon" }, { name: "state", type: "string", example: "VA" }, { name: "zip", type: "string", example: "20171" }] }] },
  { name: "Loan Limits API", tag: "Originating & Underwriting", description: "Loan limits data for US territories and counties.", implemented: true, operations: [{ id: "getAllLoanLimits", label: "Get all loan limits", params: [] }, { id: "getHistoricalLoanLimits", label: "Get historical loan limits by year", params: [{ name: "year", type: "number", example: 2015 }] }, { id: "getLoanLimitsByCounty", label: "Get loan limits by state + county", params: [{ name: "state", type: "string", example: "CA" }, { name: "county", type: "string", example: "Los Angeles" }] }] },
  { name: "Manufactured Housing Loans API", tag: "Single Family", description: "Manufactured Housing Loan data including search by specification, acquisition data, performance data.", implemented: true, operations: [
    { id: "getManufacturedHousingLoan", label: "Get a specific loan by ID", params: [{ name: "id", type: "string", example: "replace-with-real-loan-id" }] },
    { id: "getManufacturedHousingAcquisitions", label: "Get all loan acquisitions (paginated)", params: [{ name: "page", type: "string", example: "0" }] },
    { id: "getManufacturedHousingAcquisitionForId", label: "Get one loan's acquisition data by ID", params: [{ name: "id", type: "string", example: "replace-with-real-loan-id" }] },
    { id: "getManufacturedHousingPerformance", label: "Get all loan performance data (paginated)", params: [{ name: "page", type: "string", example: "0" }] },
    { id: "getManufacturedHousingPerformanceForId", label: "Get one loan's performance data by ID", params: [{ name: "id", type: "string", example: "replace-with-real-loan-id" }] },
  ] },
  { name: "National Housing Survey API", tag: "Originating & Underwriting", description: "National Housing Survey (NHS) Data.", implemented: true, operations: [{ id: "getNhsResults", label: "Get all survey results", params: [] }, { id: "getHpsiData", label: "Get all HPSI data", params: [] }, { id: "getHpsiByAreaType", label: "Get HPSI by area type", params: [{ name: "areatype", type: "string", example: "Urban" }] }, { id: "getHpsiByOwnershipStatus", label: "Get HPSI by ownership status", params: [{ name: "ownershipstatus", type: "string", example: "Owner" }] }, { id: "getHpsiByHousingCostRatio", label: "Get HPSI by housing cost ratio", params: [{ name: "housingcostratio", type: "string", example: "Under25" }] }, { id: "getHpsiByAgeGroup", label: "Get HPSI by age group", params: [{ name: "agegp", type: "string", example: "18-34" }] }, { id: "getHpsiByCensusRegion", label: "Get HPSI by census region", params: [{ name: "censusregion", type: "string", example: "South" }] }] },
  { name: "Opportunity Zones API", tag: "Originating & Underwriting", description: "Opportunity Zones for United States and its territories.", implemented: true, operations: [{ id: "validateOpportunityZoneByAddress", label: "Check if an address is in an Opportunity Zone", params: [{ name: "number", type: "string", example: "13150" }, { name: "street", type: "string", example: "Worldgate Drive" }, { name: "city", type: "string", example: "Herndon" }, { name: "state", type: "string", example: "VA" }, { name: "zip", type: "string", example: "20171" }] }, { id: "getOpportunityZoneDataForCounty", label: "Get by state + county", params: [{ name: "state", type: "string", example: "VA" }, { name: "county", type: "string", example: "Arlington" }] }] },
  { name: "Pool Prefix API", tag: "Pricing & Execution", description: "Get pool prefix data by amortization type and/or property type and/or pool prefix." },
  { name: "Re-Performing Loans API", tag: "Pricing & Execution", description: "Performance of Fannie Mae single-family mortgage loans that were permanently modified.", implemented: true, operations: [{ id: "getRplPerformanceFile", label: "Get monthly performance data", params: [] }, { id: "getRplLoanDetailFile", label: "Get static loan detail data", params: [] }] },
  { name: "Refinance Application-Level Index API", tag: "Servicing", description: "Refinance Application-Level Index data.", implemented: true, operations: [{ id: "getMostRecentRaliWeek", label: "Get most recent week", params: [] }, { id: "getRaliAllWeeks", label: "Get all weeks (2004-present)", params: [] }, { id: "getRaliByWeekRange", label: "Get by date range", params: [{ name: "startDate", type: "string", example: "2026-01-01" }, { name: "endDate", type: "string", example: "2026-03-01" }] }] },
  { name: "Single-Family Loan Performance History API", tag: "Single Family", description: "Single-Family Loan Performance History.", implemented: true, operations: [{ id: "getLphDataForYearAndQuarter", label: "Get by year + quarter", params: [{ name: "year", type: "number", example: 2020 }, { name: "quarter", type: "string", example: "Q1" }] }, { id: "getAllHarpDataset", label: "Get all HARP dataset", params: [] }, { id: "getPrimaryLphDataset", label: "Get primary dataset (2000 Q1-present)", params: [] }] },
];

export async function runOperation(operationId: string, params: Record<string, string | number>): Promise<any> {
  switch (operationId) {
    case "getAllLoanLimits": return getAllLoanLimits();
    case "getHistoricalLoanLimits": return getHistoricalLoanLimits(Number(params.year));
    case "getLoanLimitsByCounty": return getLoanLimitsByCounty(String(params.state), String(params.county));
    case "getIncomeLimitsForFipsCode": return getIncomeLimitsForFipsCode(String(params.fips_code));
    case "getIncomeLimitsByAddress": return getIncomeLimitsByAddress(String(params.number), String(params.street), String(params.city), String(params.state), String(params.zip));
    case "validateOpportunityZoneByAddress": return validateOpportunityZoneByAddress(String(params.number), String(params.street), String(params.city), String(params.state), String(params.zip));
    case "getOpportunityZoneDataForCounty": return getOpportunityZoneDataForCounty(String(params.state), params.county ? String(params.county) : undefined);
    case "getEconomicIndicatorsByName": return getEconomicIndicatorsByName(String(params.indicator));
    case "getEconomicIndicatorForYear": return getEconomicIndicatorForYear(Number(params.year));
    case "getEconomicIndicatorForYearAndQuarter": return getEconomicIndicatorForYearAndQuarter(Number(params.year), String(params.quarter));
    case "getEconomicIndicatorForYearAndMonth": return getEconomicIndicatorForYearAndMonth(Number(params.year), Number(params.month));
    case "getEconomicIndicatorForEffDateForYear": return getEconomicIndicatorForEffDateForYear(Number(params.year));
    case "getHousingIndicatorsByName": return getHousingIndicatorsByName(String(params.indicator));
    case "getHousingIndicatorForYear": return getHousingIndicatorForYear(Number(params.year));
    case "getHousingIndicatorForYearAndQuarter": return getHousingIndicatorForYearAndQuarter(Number(params.year), String(params.quarter));
    case "getHousingIndicatorForEffDateForYearAndMonth": return getHousingIndicatorForEffDateForYearAndMonth(Number(params.year), Number(params.month));
    case "getHousingIndicatorForEffDateForYear": return getHousingIndicatorForEffDateForYear(Number(params.year));
    case "getAllNationalFileB": return getAllNationalFileB(params.page ? String(params.page) : undefined);
    case "getConstructionSpendingBySection": return getConstructionSpendingBySection(String(params.section));
    case "getConstructionSpendingBySectionAndSector": return getConstructionSpendingBySectionAndSector(String(params.section), String(params.sector));
    case "getConstructionSpendingBySectionSectorAndSubsector": return getConstructionSpendingBySectionSectorAndSubsector(String(params.section), String(params.sector), String(params.subsector));
    case "getManufacturedHousingLoan": return getManufacturedHousingLoan(String(params.id));
    case "getManufacturedHousingAcquisitions": return getManufacturedHousingAcquisitions(params.page ? String(params.page) : undefined);
    case "getManufacturedHousingAcquisitionForId": return getManufacturedHousingAcquisitionForId(String(params.id));
    case "getManufacturedHousingPerformance": return getManufacturedHousingPerformance(params.page ? String(params.page) : undefined);
    case "getManufacturedHousingPerformanceForId": return getManufacturedHousingPerformanceForId(String(params.id));
    case "getNhsResults": return getNhsResults();
    case "getHpsiData": return getHpsiData();
    case "getHpsiByAreaType": return getHpsiByAreaType(String(params.areatype));
    case "getHpsiByOwnershipStatus": return getHpsiByOwnershipStatus(String(params.ownershipstatus));
    case "getHpsiByHousingCostRatio": return getHpsiByHousingCostRatio(String(params.housingcostratio));
    case "getHpsiByAgeGroup": return getHpsiByAgeGroup(String(params.agegp));
    case "getHpsiByCensusRegion": return getHpsiByCensusRegion(String(params.censusregion));
    case "getCasCurrentReportingPeriod": return getCasCurrentReportingPeriod();
    case "getCasProgramToDate": return getCasProgramToDate();
    case "getCirtCurrentReportingPeriod": return getCirtCurrentReportingPeriod();
    case "getCirtProgramToDate": return getCirtProgramToDate();
    case "getMostRecentRaliWeek": return getMostRecentRaliWeek();
    case "getRaliAllWeeks": return getRaliAllWeeks();
    case "getRaliByWeekRange": return getRaliByWeekRange(String(params.startDate), params.endDate ? String(params.endDate) : undefined);
    case "getRplPerformanceFile": return getRplPerformanceFile();
    case "getRplLoanDetailFile": return getRplLoanDetailFile();
    case "getLphDataForYearAndQuarter": return getLphDataForYearAndQuarter(Number(params.year), String(params.quarter));
    case "getAllHarpDataset": return getAllHarpDataset();
    case "getPrimaryLphDataset": return getPrimaryLphDataset();
    default: throw new Error(`Unknown operation: ${operationId}`);
  }
}
