// FIFA World Cup 2026 — data
// Tournament: June 11, 2026 → July 19, 2026
// Format: 48 teams, 12 groups of 4 (A–L), 104 matches
// Hosts: USA · Canada · Mexico
//
// Group assignments reflect the official draw held on December 5, 2025,
// in Washington, D.C. Edit as needed if the draw representation differs.

export type Confederation =
  | "UEFA"
  | "CONMEBOL"
  | "CONCACAF"
  | "AFC"
  | "CAF"
  | "OFC";

export type Team = {
  name: string;
  code: string;
  flag: string;
  confederation: Confederation;
  fifaRank: number;
  host?: boolean;
  appearances: number;
  bestFinish: string;
};

export type Group = {
  letter: string;
  teams: Team[];
};

export const TOURNAMENT = {
  name: "FIFA World Cup 2026",
  tagline: "We Are 26",
  startDate: "2026-06-11T20:00:00Z",
  endDate: "2026-07-19T20:00:00Z",
  finalVenue: "MetLife Stadium · New Jersey",
  openingVenue: "Estadio Azteca · Mexico City",
  hosts: ["United States", "Canada", "Mexico"],
  totalTeams: 48,
  totalGroups: 12,
  totalMatches: 104,
  hostCities: 16,
};

// Official December 5, 2025 draw — synced with football-data.org
// FIFA ranks reflect the official April 1, 2026 FIFA Men's World Ranking.
export const GROUPS: Group[] = [
  {
    letter: "A",
    teams: [
      { name: "Mexico",       code: "MEX", flag: "🇲🇽", confederation: "CONCACAF", fifaRank: 15, host: true, appearances: 18, bestFinish: "QF (1970, 1986)" },
      { name: "South Korea",  code: "KOR", flag: "🇰🇷", confederation: "AFC",      fifaRank: 25,            appearances: 12, bestFinish: "Semi-final (2002)" },
      { name: "Czechia",      code: "CZE", flag: "🇨🇿", confederation: "UEFA",     fifaRank: 41,            appearances: 10, bestFinish: "Runner-up (1934, 1962 as Czechoslovakia)" },
      { name: "South Africa", code: "RSA", flag: "🇿🇦", confederation: "CAF",      fifaRank: 60,            appearances: 4,  bestFinish: "Group (1998, 2002, 2010)" },
    ],
  },
  {
    letter: "B",
    teams: [
      { name: "Canada",             code: "CAN", flag: "🇨🇦", confederation: "CONCACAF", fifaRank: 30, host: true, appearances: 3, bestFinish: "Group" },
      { name: "Switzerland",        code: "SUI", flag: "🇨🇭", confederation: "UEFA",     fifaRank: 19,            appearances: 13, bestFinish: "QF (1934, 1938, 1954)" },
      { name: "Bosnia-Herzegovina", code: "BIH", flag: "🇧🇦", confederation: "UEFA",     fifaRank: 65,            appearances: 2,  bestFinish: "Group (2014)" },
      { name: "Qatar",              code: "QAT", flag: "🇶🇦", confederation: "AFC",      fifaRank: 55,            appearances: 2,  bestFinish: "Group (2022)" },
    ],
  },
  {
    letter: "C",
    teams: [
      { name: "Brazil",   code: "BRA", flag: "🇧🇷", confederation: "CONMEBOL", fifaRank: 6,  appearances: 23, bestFinish: "Champions (5×)" },
      { name: "Morocco",  code: "MAR", flag: "🇲🇦", confederation: "CAF",      fifaRank: 8,  appearances: 7,  bestFinish: "Semi-final (2022)" },
      { name: "Scotland", code: "SCO", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", confederation: "UEFA",     fifaRank: 43, appearances: 9,  bestFinish: "Group" },
      { name: "Haiti",    code: "HAI", flag: "🇭🇹", confederation: "CONCACAF", fifaRank: 83, appearances: 2,  bestFinish: "Group" },
    ],
  },
  {
    letter: "D",
    teams: [
      { name: "United States", code: "USA", flag: "🇺🇸", confederation: "CONCACAF", fifaRank: 16, host: true, appearances: 12, bestFinish: "Semi-final (1930)" },
      { name: "Australia",     code: "AUS", flag: "🇦🇺", confederation: "AFC",      fifaRank: 27,            appearances: 7,  bestFinish: "R16 (2006, 2022)" },
      { name: "Türkiye",       code: "TUR", flag: "🇹🇷", confederation: "UEFA",     fifaRank: 22,            appearances: 3,  bestFinish: "3rd (2002)" },
      { name: "Paraguay",      code: "PAR", flag: "🇵🇾", confederation: "CONMEBOL", fifaRank: 40,            appearances: 9,  bestFinish: "QF (2010)" },
    ],
  },
  {
    letter: "E",
    teams: [
      { name: "Germany",     code: "GER", flag: "🇩🇪", confederation: "UEFA",     fifaRank: 10, appearances: 21, bestFinish: "Champions (4×)" },
      { name: "Ecuador",     code: "ECU", flag: "🇪🇨", confederation: "CONMEBOL", fifaRank: 23, appearances: 5,  bestFinish: "R16 (2006)" },
      { name: "Ivory Coast", code: "CIV", flag: "🇨🇮", confederation: "CAF",      fifaRank: 34, appearances: 4,  bestFinish: "Group" },
      { name: "Curaçao",     code: "CUW", flag: "🇨🇼", confederation: "CONCACAF", fifaRank: 82, appearances: 1,  bestFinish: "Debut" },
    ],
  },
  {
    letter: "F",
    teams: [
      { name: "Netherlands", code: "NED", flag: "🇳🇱", confederation: "UEFA",     fifaRank: 7,  appearances: 12, bestFinish: "Runner-up (1974, 1978, 2010)" },
      { name: "Japan",       code: "JPN", flag: "🇯🇵", confederation: "AFC",      fifaRank: 18, appearances: 8,  bestFinish: "R16" },
      { name: "Sweden",      code: "SWE", flag: "🇸🇪", confederation: "UEFA",     fifaRank: 38, appearances: 13, bestFinish: "Runner-up (1958)" },
      { name: "Tunisia",     code: "TUN", flag: "🇹🇳", confederation: "CAF",      fifaRank: 44, appearances: 7,  bestFinish: "Group" },
    ],
  },
  {
    letter: "G",
    teams: [
      { name: "Belgium",     code: "BEL", flag: "🇧🇪", confederation: "UEFA",     fifaRank: 9,  appearances: 14, bestFinish: "3rd (2018)" },
      { name: "Iran",        code: "IRN", flag: "🇮🇷", confederation: "AFC",      fifaRank: 21, appearances: 7,  bestFinish: "Group" },
      { name: "Egypt",       code: "EGY", flag: "🇪🇬", confederation: "CAF",      fifaRank: 29, appearances: 4,  bestFinish: "Group" },
      { name: "New Zealand", code: "NZL", flag: "🇳🇿", confederation: "OFC",      fifaRank: 85, appearances: 3,  bestFinish: "Group" },
    ],
  },
  {
    letter: "H",
    teams: [
      { name: "Spain",        code: "ESP", flag: "🇪🇸", confederation: "UEFA",     fifaRank: 2,  appearances: 17, bestFinish: "Champions (2010)" },
      { name: "Uruguay",      code: "URU", flag: "🇺🇾", confederation: "CONMEBOL", fifaRank: 17, appearances: 15, bestFinish: "Champions (1930, 1950)" },
      { name: "Saudi Arabia", code: "KSA", flag: "🇸🇦", confederation: "AFC",      fifaRank: 61, appearances: 7,  bestFinish: "R16 (1994)" },
      { name: "Cape Verde",   code: "CPV", flag: "🇨🇻", confederation: "CAF",      fifaRank: 69, appearances: 1,  bestFinish: "Debut" },
    ],
  },
  {
    letter: "I",
    teams: [
      { name: "France",  code: "FRA", flag: "🇫🇷", confederation: "UEFA",     fifaRank: 1,  appearances: 17, bestFinish: "Champions (1998, 2018)" },
      { name: "Senegal", code: "SEN", flag: "🇸🇳", confederation: "CAF",      fifaRank: 14, appearances: 4,  bestFinish: "QF (2002)" },
      { name: "Norway",  code: "NOR", flag: "🇳🇴", confederation: "UEFA",     fifaRank: 31, appearances: 4,  bestFinish: "R16 (1998)" },
      { name: "Iraq",    code: "IRQ", flag: "🇮🇶", confederation: "AFC",      fifaRank: 57, appearances: 2,  bestFinish: "Group (1986)" },
    ],
  },
  {
    letter: "J",
    teams: [
      { name: "Argentina", code: "ARG", flag: "🇦🇷", confederation: "CONMEBOL", fifaRank: 3,  appearances: 19, bestFinish: "Champions (1978, 1986, 2022)" },
      { name: "Austria",   code: "AUT", flag: "🇦🇹", confederation: "UEFA",     fifaRank: 24, appearances: 8,  bestFinish: "3rd (1954)" },
      { name: "Algeria",   code: "ALG", flag: "🇩🇿", confederation: "CAF",      fifaRank: 28, appearances: 5,  bestFinish: "R16 (2014)" },
      { name: "Jordan",    code: "JOR", flag: "🇯🇴", confederation: "AFC",      fifaRank: 63, appearances: 1,  bestFinish: "Debut" },
    ],
  },
  {
    letter: "K",
    teams: [
      { name: "Portugal",   code: "POR", flag: "🇵🇹", confederation: "UEFA",     fifaRank: 5,  appearances: 9, bestFinish: "Semi-final (1966, 2006)" },
      { name: "Colombia",   code: "COL", flag: "🇨🇴", confederation: "CONMEBOL", fifaRank: 13, appearances: 7, bestFinish: "QF (2014)" },
      { name: "Congo DR",   code: "COD", flag: "🇨🇩", confederation: "CAF",      fifaRank: 46, appearances: 2, bestFinish: "Group (1974 as Zaire)" },
      { name: "Uzbekistan", code: "UZB", flag: "🇺🇿", confederation: "AFC",      fifaRank: 50, appearances: 1, bestFinish: "Debut" },
    ],
  },
  {
    letter: "L",
    teams: [
      { name: "England", code: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", confederation: "UEFA",     fifaRank: 4,  appearances: 17, bestFinish: "Champions (1966)" },
      { name: "Croatia", code: "CRO", flag: "🇭🇷", confederation: "UEFA",     fifaRank: 11, appearances: 7,  bestFinish: "Runner-up (2018)" },
      { name: "Ghana",   code: "GHA", flag: "🇬🇭", confederation: "CAF",      fifaRank: 74, appearances: 5,  bestFinish: "QF (2010)" },
      { name: "Panama",  code: "PAN", flag: "🇵🇦", confederation: "CONCACAF", fifaRank: 33, appearances: 2,  bestFinish: "Group (2018)" },
    ],
  },
];

export const CONFED_COLOR: Record<Confederation, string> = {
  UEFA:     "#3b82f6",
  CONMEBOL: "#eab308",
  CONCACAF: "#10b981",
  AFC:      "#a855f7",
  CAF:      "#f97316",
  OFC:      "#ec4899",
};

export type HostCity = {
  city: string;
  country: string;
  stadium: string;
  capacity: number;
  matches: number;       // total matches hosted at this venue
  highlight?: "opening" | "final" | "third"; // notable role
};

// Match counts per FIFA's published 2026 schedule (totals to 104).
export const HOST_CITIES: HostCity[] = [
  { city: "Mexico City",    country: "Mexico",  stadium: "Estadio Azteca",          capacity: 87000, matches: 5, highlight: "opening" },
  { city: "Guadalajara",    country: "Mexico",  stadium: "Estadio Akron",           capacity: 49000, matches: 4 },
  { city: "Monterrey",      country: "Mexico",  stadium: "Estadio BBVA",            capacity: 53500, matches: 4 },
  { city: "Toronto",        country: "Canada",  stadium: "BMO Field",               capacity: 45000, matches: 6 },
  { city: "Vancouver",      country: "Canada",  stadium: "BC Place",                capacity: 54500, matches: 7 },
  { city: "Atlanta",        country: "USA",     stadium: "Mercedes-Benz Stadium",   capacity: 71000, matches: 8 },
  { city: "Boston",         country: "USA",     stadium: "Gillette Stadium",        capacity: 65000, matches: 7 },
  { city: "Dallas",         country: "USA",     stadium: "AT&T Stadium",            capacity: 80000, matches: 9 },
  { city: "Houston",        country: "USA",     stadium: "NRG Stadium",             capacity: 72000, matches: 7 },
  { city: "Kansas City",    country: "USA",     stadium: "Arrowhead Stadium",       capacity: 76000, matches: 6 },
  { city: "Los Angeles",    country: "USA",     stadium: "SoFi Stadium",            capacity: 70000, matches: 8 },
  { city: "Miami",          country: "USA",     stadium: "Hard Rock Stadium",       capacity: 65000, matches: 7, highlight: "third" },
  { city: "New York / NJ",  country: "USA",     stadium: "MetLife Stadium",         capacity: 82500, matches: 8, highlight: "final" },
  { city: "Philadelphia",   country: "USA",     stadium: "Lincoln Financial Field", capacity: 69000, matches: 6 },
  { city: "San Francisco",  country: "USA",     stadium: "Levi's Stadium",          capacity: 68500, matches: 6 },
  { city: "Seattle",        country: "USA",     stadium: "Lumen Field",             capacity: 69000, matches: 6 },
];
