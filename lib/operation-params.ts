import { z } from "zod";

/**
 * Single source of truth for the parameters any catalog operation can take.
 *
 * Both tool surfaces spread this into their inputSchema:
 *   - call_fnma_api        (app/api/[transport]/route.ts) -- raw JSON
 *   - fnma_show_api_detail (lib/widgets.ts)               -- widget
 *
 * These lists used to be maintained separately, which meant adding an
 * operation to API_CATALOG could leave one tool unable to pass its params:
 * the catalog advertised the operation, the tool surface couldn't invoke it.
 * Add new params HERE and both tools pick them up.
 */
export const OPERATION_PARAMS = {
  // geography / address
  state: z.string().optional(),
  county: z.string().optional(),
  fips_code: z.string().optional(),
  number: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  address: z
    .string()
    .optional()
    .describe("Full free-text address, for validateOpportunityZoneByAddressPost"),

  // time
  year: z.number().optional(),
  month: z.number().optional(),
  quarter: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),

  // generic
  indicator: z.string().optional(),
  page: z.string().optional(),
  id: z.string().optional(),

  // construction spending
  section: z.string().optional(),
  sector: z.string().optional(),
  subsector: z.string().optional(),
  queryItems: z
    .string()
    .optional()
    .describe(
      "Batch construction-spending paths for getMultipleConstructionSpending. " +
        "Pipe separates items, slash separates section/sector/subsector, e.g. " +
        "'Total | Total/Residential | Private/Nonresidential/Office'"
    ),

  // pool prefix
  businessLine: z.string().optional().describe("Pool prefix business line, e.g. 'Single-Family' or 'Multifamily'"),
  amortizationType: z.string().optional().describe("Pool prefix amortization type, e.g. 'Fixed' or 'ARM'"),
  prefix: z.string().optional().describe("Two-letter pool prefix, e.g. '2L'"),
  keyword: z.string().optional().describe("Pool prefix description keyword, e.g. 'Reperforming'"),
  prefixRequests: z
    .string()
    .optional()
    .describe(
      "Batch pool-prefix requests for getMultiplePoolPrefixes. Pipe separates " +
        "items, slash separates businessLine/amortizationType, e.g. " +
        "'Single-Family/Fixed | Multifamily/ARM'"
    ),

  // HERA aggregation
  aggregationColumns: z.string().optional().describe("HERA aggregation columns"),
  groupByColumns: z.string().optional().describe("HERA group-by columns, comma-separated"),
  whereClauseColumns: z.string().optional().describe("HERA where-clause columns"),
  whereClauseValues: z
    .string()
    .optional()
    .describe("HERA where-clause values, pipe-separated, positionally matching whereClauseColumns"),

  // national housing survey
  areatype: z.string().optional(),
  ownershipstatus: z.string().optional(),
  housingcostratio: z.string().optional(),
  agegp: z.string().optional(),
  censusregion: z.string().optional(),
  incomegp: z.string().optional(),
  educationlvl: z.string().optional(),
};

/** Shared blurb about the batch encoding, appended to both tool descriptions. */
export const BATCH_ENCODING_NOTE =
  "Batch operations (getMultipleConstructionSpending, getMultiplePoolPrefixes) " +
  "take their list as a single string: pipe separates items, slash separates " +
  "fields within an item, e.g. " +
  "queryItems='Total | Total/Residential | Private/Nonresidential/Office'. " +
  "Every operation is read-only, including the ones issued as POST.";
