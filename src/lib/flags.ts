// Maps FIFA 3-letter team codes to ISO 3166-1 alpha-2 codes used by flagcdn.com.
// Subdivision flags (Scotland, England) use the flagcdn subdivision format.
// https://flagcdn.com/{iso2}.svg  (or /w40/{iso2}.png for raster)

const FIFA_TO_ISO2: Record<string, string> = {
  ALG: "dz",
  ARG: "ar",
  AUS: "au",
  AUT: "at",
  BEL: "be",
  BIH: "ba",
  BRA: "br",
  CAN: "ca",
  CIV: "ci",
  COD: "cd",
  COL: "co",
  CPV: "cv",
  CRO: "hr",
  CUW: "cw",
  CZE: "cz",
  ECU: "ec",
  EGY: "eg",
  ENG: "gb-eng",
  ESP: "es",
  FRA: "fr",
  GER: "de",
  GHA: "gh",
  HAI: "ht",
  IRN: "ir",
  IRQ: "iq",
  JOR: "jo",
  JPN: "jp",
  KOR: "kr",
  KSA: "sa",
  MAR: "ma",
  MEX: "mx",
  NED: "nl",
  NOR: "no",
  NZL: "nz",
  PAN: "pa",
  PAR: "py",
  POR: "pt",
  QAT: "qa",
  RSA: "za",
  SCO: "gb-sct",
  SEN: "sn",
  SUI: "ch",
  SWE: "se",
  TUN: "tn",
  TUR: "tr",
  URU: "uy",
  USA: "us",
  UZB: "uz",
};

/**
 * Returns a flagcdn.com PNG URL for a FIFA team code.
 * Falls back to a transparent 1×1 pixel if the code is unknown.
 */
export function flagUrl(fifaCode: string, width: 20 | 40 | 80 = 40): string {
  const iso2 = FIFA_TO_ISO2[fifaCode];
  if (!iso2) return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  return `https://flagcdn.com/w${width}/${iso2}.png`;
}
