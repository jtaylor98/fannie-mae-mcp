import type { ApiCatalogEntry } from "./fanniemae";

/**
 * Business line is a second dimension, orthogonal to the functional `tag`
 * (Pricing & Execution / Originating & Underwriting / Servicing).
 *
 * It lives here rather than in API_CATALOG so the assignments can be argued
 * over and edited without touching the operation definitions.
 *
 * "Market & Reference" is not a hedge -- a large part of this catalog is
 * macro, geography, or survey data that has no loan business line at all.
 * Forcing those into Single Family or Multifamily would be wrong.
 */
export type BusinessLine = "Single Family" | "Multifamily" | "Both" | "Market & Reference";

/** Render order. Multifamily is deliberately listed even when empty -- the
 *  absence is informative: no API in this catalog is multifamily-only. */
export const BUSINESS_LINE_ORDER: BusinessLine[] = [
  "Single Family",
  "Multifamily",
  "Both",
  "Market & Reference",
];

export const BUSINESS_LINE: Record<string, BusinessLine> = {
  // --- Stated in the spec text itself ---
  // "Single-Family Connecticut Avenue Securities (CAS) deals"
  "Connecticut Avenue Securities API": "Single Family",
  // "Single-Family Credit Insurance Risk Transfer (CIRT) deals"
  "Credit Insurance Risk Transfer API": "Single Family",
  // "single-family mortgage loans that were permanently modified"
  "Re-Performing Loans API": "Single Family",
  // Single Family is in the API's own name
  "Single-Family Loan Performance History API": "Single Family",
  // Only National File B is exposed here, which is Single-Family unit-level
  // properties. The wider HERA Public Use Database does have multifamily
  // files; they are not in this connector.
  "Housing and Economic Recovery Act (HERA) API": "Single Family",
  // Manufactured housing is a single-family product line.
  "Manufactured Housing Loans API": "Single Family",

  // --- Genuinely both, and the only one ---
  // Every record carries business-line: "Single-Family" | "Multifamily".
  "Pool Prefix API": "Both",

  // --- No loan business line ---
  // Census value-of-construction data. Splits Residential/Nonresidential,
  // which is not the same axis as Single Family/Multifamily.
  "Construction Spending API": "Market & Reference",
  // Macroeconomic forecast series.
  "Economic Indicators API": "Market & Reference",
  // Housing forecast series. Mentions multifamily only as an indicator name
  // (multifamily-2+units-housing-starts), not as a business line.
  "Housing Indicators API": "Market & Reference",
  // Consumer sentiment survey, not loan-level.
  "National Housing Survey API": "Market & Reference",
  // Census-tract geography.
  "Opportunity Zones API": "Market & Reference",
  // Internal services utility, no loan data.
  "Gateway Services Public API": "Market & Reference",

  // --- Judgment calls, flagged rather than buried ---
  // FHFA conforming limits are expressed as one- through four-unit limits,
  // and 1-4 units is the agency definition of single family. Filed under
  // reference data because the API is keyed by geography and carries no
  // loan or business-line field. Move to Single Family if you disagree.
  "Loan Limits API": "Market & Reference",
  // AMI limits drive HomeReady, a single-family product, but the API itself
  // is census-tract reference data with no business-line field.
  "Income Limits API": "Market & Reference",
  // Refinance application index. Almost certainly single-family volume, but
  // nothing in the spec or the response says so.
  "Refinance Application-Level Index API": "Market & Reference",
};

/** Attaches businessLine to a catalog entry for the widgets to group on. */
export function withBusinessLine<T extends ApiCatalogEntry>(entry: T) {
  return { ...entry, businessLine: BUSINESS_LINE[entry.name] ?? "Market & Reference" };
}
