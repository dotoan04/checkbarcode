// Tang 0 - Local GTIN validation and structural analysis.
// Pure, offline, deterministic. No network calls.

export type GtinFormat = "GTIN-8" | "GTIN-12" | "GTIN-13" | "GTIN-14" | "UNKNOWN";

export interface GtinAnalysis {
  raw: string;
  normalized: string; // digits only
  valid: boolean;
  format: GtinFormat;
  checkDigitOk: boolean;
  expectedCheckDigit: number | null;
  gs1Prefix: string | null; // first 3 digits (GS1 prefix block)
  prefixOrganization: string | null; // country / organization that owns the prefix range
  isRestrictedCirculation: boolean; // in-store / coupon ranges, not a real product GTIN
  errors: string[];
}

// GS1 prefix ranges -> issuing Member Organisation (country) or special use.
// Source: GS1 General Specifications prefix allocation table (condensed).
interface PrefixRange {
  from: number;
  to: number;
  org: string;
  restricted?: boolean;
}

const PREFIX_RANGES: PrefixRange[] = [
  { from: 0, to: 19, org: "USA & Canada (UPC-A)" },
  { from: 20, to: 29, org: "Restricted circulation (in-store)", restricted: true },
  { from: 30, to: 39, org: "USA (drugs / NDC)" },
  { from: 40, to: 49, org: "Restricted circulation (company internal)", restricted: true },
  { from: 50, to: 59, org: "Reserved for coupons", restricted: true },
  { from: 60, to: 139, org: "USA & Canada" },
  { from: 200, to: 299, org: "Restricted circulation (in-store)", restricted: true },
  { from: 300, to: 379, org: "France & Monaco" },
  { from: 380, to: 380, org: "Bulgaria" },
  { from: 383, to: 383, org: "Slovenia" },
  { from: 385, to: 385, org: "Croatia" },
  { from: 387, to: 387, org: "Bosnia and Herzegovina" },
  { from: 389, to: 389, org: "Montenegro" },
  { from: 390, to: 390, org: "Kosovo" },
  { from: 400, to: 440, org: "Germany" },
  { from: 450, to: 459, org: "Japan" },
  { from: 460, to: 469, org: "Russia" },
  { from: 470, to: 470, org: "Kyrgyzstan" },
  { from: 471, to: 471, org: "Taiwan" },
  { from: 474, to: 474, org: "Estonia" },
  { from: 475, to: 475, org: "Latvia" },
  { from: 476, to: 476, org: "Azerbaijan" },
  { from: 477, to: 477, org: "Lithuania" },
  { from: 478, to: 478, org: "Uzbekistan" },
  { from: 479, to: 479, org: "Sri Lanka" },
  { from: 480, to: 480, org: "Philippines" },
  { from: 481, to: 481, org: "Belarus" },
  { from: 482, to: 482, org: "Ukraine" },
  { from: 483, to: 483, org: "Turkmenistan" },
  { from: 484, to: 484, org: "Moldova" },
  { from: 485, to: 485, org: "Armenia" },
  { from: 486, to: 486, org: "Georgia" },
  { from: 487, to: 487, org: "Kazakhstan" },
  { from: 488, to: 488, org: "Tajikistan" },
  { from: 489, to: 489, org: "Hong Kong" },
  { from: 490, to: 499, org: "Japan" },
  { from: 500, to: 509, org: "United Kingdom" },
  { from: 520, to: 521, org: "Greece" },
  { from: 528, to: 528, org: "Lebanon" },
  { from: 529, to: 529, org: "Cyprus" },
  { from: 530, to: 530, org: "Albania" },
  { from: 531, to: 531, org: "North Macedonia" },
  { from: 535, to: 535, org: "Malta" },
  { from: 539, to: 539, org: "Ireland" },
  { from: 540, to: 549, org: "Belgium & Luxembourg" },
  { from: 560, to: 560, org: "Portugal" },
  { from: 569, to: 569, org: "Iceland" },
  { from: 570, to: 579, org: "Denmark, Faroe Islands & Greenland" },
  { from: 590, to: 590, org: "Poland" },
  { from: 594, to: 594, org: "Romania" },
  { from: 599, to: 599, org: "Hungary" },
  { from: 600, to: 601, org: "South Africa" },
  { from: 603, to: 603, org: "Ghana" },
  { from: 604, to: 604, org: "Senegal" },
  { from: 608, to: 608, org: "Bahrain" },
  { from: 609, to: 609, org: "Mauritius" },
  { from: 611, to: 611, org: "Morocco" },
  { from: 613, to: 613, org: "Algeria" },
  { from: 615, to: 615, org: "Nigeria" },
  { from: 616, to: 616, org: "Kenya" },
  { from: 618, to: 618, org: "Ivory Coast" },
  { from: 619, to: 619, org: "Tunisia" },
  { from: 620, to: 620, org: "Tanzania" },
  { from: 621, to: 621, org: "Syria" },
  { from: 622, to: 622, org: "Egypt" },
  { from: 623, to: 623, org: "Brunei" },
  { from: 624, to: 624, org: "Libya" },
  { from: 625, to: 625, org: "Jordan" },
  { from: 626, to: 626, org: "Iran" },
  { from: 627, to: 627, org: "Kuwait" },
  { from: 628, to: 628, org: "Saudi Arabia" },
  { from: 629, to: 629, org: "United Arab Emirates" },
  { from: 630, to: 630, org: "Qatar" },
  { from: 640, to: 649, org: "Finland" },
  { from: 690, to: 699, org: "China" },
  { from: 700, to: 709, org: "Norway" },
  { from: 729, to: 729, org: "Israel" },
  { from: 730, to: 739, org: "Sweden" },
  { from: 740, to: 740, org: "Guatemala" },
  { from: 741, to: 741, org: "El Salvador" },
  { from: 742, to: 742, org: "Honduras" },
  { from: 743, to: 743, org: "Nicaragua" },
  { from: 744, to: 744, org: "Costa Rica" },
  { from: 745, to: 745, org: "Panama" },
  { from: 746, to: 746, org: "Dominican Republic" },
  { from: 750, to: 750, org: "Mexico" },
  { from: 754, to: 755, org: "Canada" },
  { from: 759, to: 759, org: "Venezuela" },
  { from: 760, to: 769, org: "Switzerland & Liechtenstein" },
  { from: 770, to: 771, org: "Colombia" },
  { from: 773, to: 773, org: "Uruguay" },
  { from: 775, to: 775, org: "Peru" },
  { from: 777, to: 777, org: "Bolivia" },
  { from: 778, to: 779, org: "Argentina" },
  { from: 780, to: 780, org: "Chile" },
  { from: 784, to: 784, org: "Paraguay" },
  { from: 786, to: 786, org: "Ecuador" },
  { from: 789, to: 790, org: "Brazil" },
  { from: 800, to: 839, org: "Italy, San Marino & Vatican City" },
  { from: 840, to: 849, org: "Spain & Andorra" },
  { from: 850, to: 850, org: "Cuba" },
  { from: 858, to: 858, org: "Slovakia" },
  { from: 859, to: 859, org: "Czech Republic" },
  { from: 860, to: 860, org: "Serbia" },
  { from: 865, to: 865, org: "Mongolia" },
  { from: 867, to: 867, org: "North Korea" },
  { from: 868, to: 869, org: "Turkey" },
  { from: 870, to: 879, org: "Netherlands" },
  { from: 880, to: 880, org: "South Korea" },
  { from: 883, to: 883, org: "Myanmar" },
  { from: 884, to: 884, org: "Cambodia" },
  { from: 885, to: 885, org: "Thailand" },
  { from: 888, to: 888, org: "Singapore" },
  { from: 890, to: 890, org: "India" },
  { from: 893, to: 893, org: "Vietnam" },
  { from: 896, to: 896, org: "Pakistan" },
  { from: 899, to: 899, org: "Indonesia" },
  { from: 900, to: 919, org: "Austria" },
  { from: 930, to: 939, org: "Australia" },
  { from: 940, to: 949, org: "New Zealand" },
  { from: 950, to: 950, org: "GS1 Global Office" },
  { from: 951, to: 951, org: "GS1 Global Office (EPC general manager)" },
  { from: 955, to: 955, org: "Malaysia" },
  { from: 958, to: 958, org: "Macau" },
  { from: 960, to: 969, org: "GS1 Global Office (GTIN-8 allocations)" },
  { from: 977, to: 977, org: "Serial publications (ISSN)", restricted: true },
  { from: 978, to: 979, org: "Bookland (ISBN)", restricted: true },
  { from: 980, to: 980, org: "Refund receipts", restricted: true },
  { from: 981, to: 984, org: "GS1 coupon identification", restricted: true },
  { from: 990, to: 999, org: "GS1 coupon identification", restricted: true },
];

function lookupPrefix(prefix3: number): PrefixRange | null {
  for (const range of PREFIX_RANGES) {
    if (prefix3 >= range.from && prefix3 <= range.to) return range;
  }
  return null;
}

/**
 * Compute the GS1 mod-10 check digit for a digit string WITHOUT its check digit.
 * Works for GTIN-8/12/13/14 (and any even/odd length): weight from the right is 3,1,3,1...
 */
export function computeCheckDigit(payloadDigits: string): number {
  let sum = 0;
  // Rightmost payload digit gets weight 3, then alternate.
  for (let i = 0; i < payloadDigits.length; i++) {
    const digit = payloadDigits.charCodeAt(payloadDigits.length - 1 - i) - 48;
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

function detectFormat(len: number): GtinFormat {
  switch (len) {
    case 8:
      return "GTIN-8";
    case 12:
      return "GTIN-12";
    case 13:
      return "GTIN-13";
    case 14:
      return "GTIN-14";
    default:
      return "UNKNOWN";
  }
}

/**
 * Analyze a raw barcode string: normalize, validate check digit, derive
 * GS1 prefix and issuing organization, flag restricted-circulation ranges.
 */
export function analyzeGtin(raw: string): GtinAnalysis {
  const errors: string[] = [];
  const normalized = (raw ?? "").replace(/\D/g, "");

  const result: GtinAnalysis = {
    raw,
    normalized,
    valid: false,
    format: "UNKNOWN",
    checkDigitOk: false,
    expectedCheckDigit: null,
    gs1Prefix: null,
    prefixOrganization: null,
    isRestrictedCirculation: false,
    errors,
  };

  if (normalized.length === 0) {
    errors.push("Empty or non-numeric barcode.");
    return result;
  }

  const format = detectFormat(normalized.length);
  result.format = format;
  if (format === "UNKNOWN") {
    errors.push(
      `Invalid length ${normalized.length}. Expected 8, 12, 13 or 14 digits.`
    );
    return result;
  }

  const payload = normalized.slice(0, -1);
  const actualCheck = normalized.charCodeAt(normalized.length - 1) - 48;
  const expected = computeCheckDigit(payload);
  result.expectedCheckDigit = expected;
  result.checkDigitOk = expected === actualCheck;
  if (!result.checkDigitOk) {
    errors.push(
      `Check digit mismatch: expected ${expected}, got ${actualCheck}.`
    );
  }

  // Derive GS1 prefix. For GTIN-14 the leading digit is a packaging indicator;
  // for GTIN-12 (UPC-A) we left-pad to 13 to read the prefix consistently.
  let gtin13: string;
  if (format === "GTIN-14") {
    gtin13 = normalized.slice(1); // drop indicator digit
  } else if (format === "GTIN-12") {
    gtin13 = "0" + normalized;
  } else if (format === "GTIN-8") {
    gtin13 = normalized.padStart(13, "0");
  } else {
    gtin13 = normalized;
  }

  const prefix3 = gtin13.slice(0, 3);
  result.gs1Prefix = prefix3;
  const range = lookupPrefix(parseInt(prefix3, 10));
  if (range) {
    result.prefixOrganization = range.org;
    result.isRestrictedCirculation = Boolean(range.restricted);
    if (range.restricted) {
      errors.push(
        `Prefix ${prefix3} is a restricted-circulation range (${range.org}); not a standard retail GTIN.`
      );
    }
  } else {
    result.prefixOrganization = "Unassigned / reserved prefix";
    errors.push(`Prefix ${prefix3} is not in the published GS1 allocation table.`);
  }

  // Format is guaranteed valid here (UNKNOWN length returns early above).
  result.valid = result.checkDigitOk;
  return result;
}
