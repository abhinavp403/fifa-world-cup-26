// World Cup 2026 squad data — tournament stats only.
// All stats start at 0 and update once matches begin.
// Jersey numbers are provisional (official FIFA numbers published ~June 1).

export type PlayerStats = {
  appearances:    number;
  minutesPlayed:  number;
  goals:          number;
  assists:        number;
  shots:          number;
  shotsOnTarget:  number;
  keyPasses:      number;
  passes:         number;
  dribbles:       number;
  tackles:        number;
  interceptions:  number;
  saves:          number;
  cleanSheets:    number;
  goalsConceded:  number;
};

export const ZERO_STATS: PlayerStats = {
  appearances: 0, minutesPlayed: 0, goals: 0, assists: 0,
  shots: 0, shotsOnTarget: 0, keyPasses: 0, passes: 0,
  dribbles: 0, tackles: 0, interceptions: 0,
  saves: 0, cleanSheets: 0, goalsConceded: 0,
};

export type SquadPlayer = {
  name:      string;
  number:    number;
  position:  "GK" | "DEF" | "MID" | "FWD";
  club:      string;
  age:       number;
  captain?:  boolean;
  photo?:    string;
  stats?:    PlayerStats;
};

export type Squad = {
  coach:   string;
  players: SquadPlayer[];
};

const p = (url: string) => `https://r2.thesportsdb.com/images/media/player/cutout/${url}`;
const s = (id: number) => `/api/player-photo/${id}`;

export const SQUADS: Record<string, Squad> = {

  // ─── France ───────────────────────────────────────────────────────────────
  FRA: {
    coach: "Didier Deschamps",
    players: [
      { name: "Mike Maignan",        number: 1,  position: "GK",  club: "AC Milan",              age: 30, photo: p("sw5ukh1758892671.png") },
      { name: "Alphonse Areola",     number: 16, position: "GK",  club: "West Ham United",        age: 32, photo: p("istdrx1756985080.png") },
      { name: "Brice Samba",         number: 23, position: "GK",  club: "RC Lens",                age: 31, photo: p("nkfugp1766137864.png") },
      { name: "Benjamin Pavard",     number: 2,  position: "DEF", club: "Inter Milan",            age: 30, photo: p("d9p3381766153512.png") },
      { name: "Jules Koundé",        number: 5,  position: "DEF", club: "FC Barcelona",           age: 28, photo: p("qea88i1726509803.png") },
      { name: "Dayot Upamecano",     number: 4,  position: "DEF", club: "Bayern Munich",          age: 27, photo: p("a1hyfj1756416177.png") },
      { name: "William Saliba",      number: 17, position: "DEF", club: "Arsenal",                age: 25, photo: p("czasy21769331889.png") },
      { name: "Ibrahima Konaté",     number: 15, position: "DEF", club: "Liverpool",              age: 26, photo: p("izock91757088476.png") },
      { name: "Théo Hernandez",      number: 22, position: "DEF", club: "AC Milan",               age: 28, photo: p("4d3g7j1675234242.png") },
      { name: "Lucas Hernandez",     number: 3,  position: "DEF", club: "Paris Saint-Germain",    age: 29, photo: p("2ugny71766335261.png") },
      { name: "Ferland Mendy",       number: 20, position: "DEF", club: "Real Madrid",            age: 30, photo: p("3kzpr31733653604.png") },
      { name: "Aurélien Tchouaméni", number: 8,  position: "MID", club: "Real Madrid",            age: 26, photo: p("4o417k1733653668.png") },
      { name: "Eduardo Camavinga",   number: 6,  position: "MID", club: "Real Madrid",            age: 23, photo: p("viijpx1733653403.png") },
      { name: "N'Golo Kanté",        number: 13, position: "MID", club: "Al-Ittihad",             age: 35, photo: p("ld6low1719039995.png") },
      { name: "Youssouf Fofana",     number: 14, position: "MID", club: "AC Milan",               age: 26, photo: p("3npg7a1758892447.png") },
      { name: "Warren Zaïre-Emery",  number: 18, position: "MID", club: "Paris Saint-Germain",    age: 20, photo: p("fjxbac1766335583.png") },
      { name: "Adrien Rabiot",       number: 24, position: "MID", club: "Olympique de Marseille", age: 31, photo: p("m2upnx1758893486.png") },
      { name: "Khéphren Thuram",     number: 25, position: "MID", club: "Juventus",               age: 23, photo: p("z7zq751759225259.png") },
      { name: "Mattéo Guendouzi",    number: 26, position: "MID", club: "Olympique de Marseille", age: 26, photo: p("tcelg91769179721.png") },
      { name: "Kylian Mbappé",       number: 10, position: "FWD", club: "Real Madrid",            age: 27, captain: true, photo: p("h9u9vz1733653583.png") },
      { name: "Marcus Thuram",       number: 9,  position: "FWD", club: "Inter Milan",            age: 28, photo: p("aykui01759408989.png") },
      { name: "Ousmane Dembélé",     number: 11, position: "FWD", club: "Paris Saint-Germain",    age: 29, photo: p("pstgy21766335175.png") },
      { name: "Kingsley Coman",      number: 7,  position: "FWD", club: "Bayern Munich",          age: 30, photo: p("bfe40s1770542910.png") },
      { name: "Bradley Barcola",     number: 19, position: "FWD", club: "Paris Saint-Germain",    age: 23, photo: p("l2v71f1766334537.png") },
      { name: "Randal Kolo Muani",   number: 21, position: "FWD", club: "Paris Saint-Germain",    age: 27, photo: p("h89zyk1768679563.png") },
      { name: "Michael Olise",       number: 12, position: "FWD", club: "Bayern Munich",          age: 23, photo: p("r4vx6b1756408807.png") },
    ],
  },

  // ─── Belgium ──────────────────────────────────────────────────────────────
  BEL: {
    coach: "Rudi Garcia",
    players: [
      { name: "Thibaut Courtois",       number: 1,  position: "GK",  club: "Real Madrid",            age: 34, photo: p("592mar1733653475.png") },
      { name: "Senne Lammens",          number: 12, position: "GK",  club: "Manchester United",       age: 23, photo: p("8xh9d61766826762.png") },
      { name: "Mike Penders",           number: 23, position: "GK",  club: "Strasbourg",              age: 20, photo: p("9y7efe1766053806.png") },
      { name: "Timothy Castagne",       number: 2,  position: "DEF", club: "Fulham",                  age: 30, photo: p("uc84ft1757070324.png") },
      { name: "Maxim De Cuyper",        number: 3,  position: "DEF", club: "Brighton",                age: 25, photo: p("yo44zc1756993970.png") },
      { name: "Joaquin Seys",           number: 4,  position: "DEF", club: "Club Brugge",             age: 21, photo: p("34zoma1767634511.png") },
      { name: "Koni De Winter",         number: 5,  position: "DEF", club: "AC Milan",                age: 23, photo: p("zl0vt51758893255.png") },
      { name: "Thomas Meunier",         number: 6,  position: "DEF", club: "Lille",                   age: 34, photo: p("r7zcgl1766077606.png") },
      { name: "Nathan Ngoy",            number: 7,  position: "DEF", club: "Lille",                   age: 22, photo: p("dj91a01766077637.png") },
      { name: "Brandon Mechele",        number: 8,  position: "DEF", club: "Club Brugge",             age: 32, photo: p("vicmek1767634348.png") },
      { name: "Zeno Debast",            number: 9,  position: "DEF", club: "Sporting CP",             age: 22, photo: p("xlp81e1716408284.png") },
      { name: "Arthur Theate",          number: 10, position: "DEF", club: "Eintracht Frankfurt",     age: 25, photo: p("tr7ftn1762287457.png") },
      { name: "Kevin De Bruyne",        number: 11, position: "MID", club: "Napoli",                  age: 34, captain: true, photo: p("o4flia1764089447.png") },
      { name: "Amadou Onana",           number: 13, position: "MID", club: "Aston Villa",             age: 24, photo: p("q2bvps1725359471.png") },
      { name: "Youri Tielemans",        number: 14, position: "MID", club: "Aston Villa",             age: 29, photo: p("dvyawe1756987280.png") },
      { name: "Axel Witsel",            number: 15, position: "MID", club: "Girona",                  age: 37, photo: p("13uvke1762457461.png") },
      { name: "Nicolas Raskin",         number: 16, position: "MID", club: "Rangers",                 age: 25, photo: p("zdlxoe1701946661.png") },
      { name: "Hans Vanaken",           number: 17, position: "MID", club: "Club Brugge",             age: 33, photo: p("r681jn1767640917.png") },
      { name: "Romelu Lukaku",          number: 18, position: "FWD", club: "Napoli",                  age: 32, photo: p("qi2z1d1764089572.png") },
      { name: "Jérémy Doku",            number: 19, position: "FWD", club: "Manchester City",         age: 23, photo: p("tehbsx1769183074.png") },
      { name: "Leandro Trossard",       number: 20, position: "FWD", club: "Arsenal",                 age: 31, photo: p("07fzpg1769331977.png") },
      { name: "Charles De Ketelaere",   number: 21, position: "FWD", club: "Atalanta",                age: 25, photo: p("wqo9ia1695157273.png") },
      { name: "Dodi Lukebakio",         number: 22, position: "FWD", club: "Benfica",                 age: 28, photo: p("335dwm1724784475.png") },
      { name: "Matias Fernandez-Pardo", number: 24, position: "FWD", club: "Lille",                   age: 21, photo: p("8vhxnr1766077473.png") },
      { name: "Diego Moreira",          number: 25, position: "FWD", club: "Strasbourg",              age: 21, photo: p("eyaz0q1766053833.png") },
      { name: "Alexis Saelemaekers",    number: 26, position: "FWD", club: "AC Milan",                age: 26, photo: p("li7qc71758893296.png") },
    ],
  },

  // ─── Japan ────────────────────────────────────────────────────────────────
  JPN: {
    coach: "Hajime Moriyasu",
    players: [
      { name: "Zion Suzuki",        number: 1,  position: "GK",  club: "Parma",                 age: 22, photo: p("24eahn1759780929.png") },
      { name: "Keisuke Osako",      number: 12, position: "GK",  club: "Sanfrecce Hiroshima",   age: 29, photo: s(831923) },
      { name: "Tomoki Hayakawa",    number: 23, position: "GK",  club: "Kashima Antlers",       age: 24, photo: s(1100230) },
      { name: "Hiroki Ito",         number: 2,  position: "DEF", club: "Bayern Munich",         age: 25, photo: p("bm4rkl1630672664.png") },
      { name: "Ko Itakura",         number: 3,  position: "DEF", club: "Ajax",                  age: 28, photo: p("v3ptg81759497926.png") },
      { name: "Takehiro Tomiyasu",  number: 4,  position: "DEF", club: "Ajax",                  age: 26, photo: p("sfhhub1694204158.png") },
      { name: "Tsuyoshi Watanabe",  number: 5,  position: "DEF", club: "Feyenoord",             age: 25, photo: p("qv35e31758189015.png") },
      { name: "Ayumu Seko",         number: 6,  position: "DEF", club: "Le Havre",              age: 23, photo: p("jdghy41765990722.png") },
      { name: "Junnosuke Suzuki",   number: 7,  position: "DEF", club: "FC Copenhagen",         age: 22, photo: s(1171902) },
      { name: "Shogo Taniguchi",    number: 8,  position: "DEF", club: "Sint-Truidense VV",     age: 35, photo: p("jo3sz21767196242.png") },
      { name: "Yukinari Sugawara",  number: 9,  position: "DEF", club: "Werder Bremen",         age: 24, photo: p("9znmfg1763666295.png") },
      { name: "Yuto Nagatomo",      number: 10, position: "DEF", club: "FC Tokyo",              age: 39, photo: p("175zfx1609244659.png") },
      { name: "Wataru Endo",        number: 11, position: "MID", club: "Liverpool",             age: 31, captain: true, photo: p("eawsfp1757087920.png") },
      { name: "Kaishu Sano",        number: 13, position: "MID", club: "Mainz 05",              age: 23, photo: p("fkpbew1763558803.png") },
      { name: "Daichi Kamada",      number: 14, position: "MID", club: "Crystal Palace",        age: 28, photo: p("xajscx1761492482.png") },
      { name: "Ao Tanaka",          number: 15, position: "MID", club: "Leeds United",          age: 26, photo: p("xptxxr1424975941.png") },
      { name: "Yuito Suzuki",       number: 16, position: "MID", club: "SC Freiburg",           age: 22, photo: p("f0e6t11763329132.png") },
      { name: "Keito Nakamura",     number: 17, position: "FWD", club: "Stade de Reims",        age: 24, photo: p("rvg6ub1678454947.png") },
      { name: "Junya Ito",          number: 18, position: "FWD", club: "Genk",                  age: 32, photo: p("sl5pc01767641839.png") },
      { name: "Takefusa Kubo",      number: 19, position: "FWD", club: "Real Sociedad",         age: 23, photo: p("bb8sw01762709094.png") },
      { name: "Ritsu Doan",         number: 20, position: "FWD", club: "Eintracht Frankfurt",   age: 26, photo: p("6526j01762287692.png") },
      { name: "Daizen Maeda",       number: 21, position: "FWD", club: "Celtic",                age: 27, photo: s(832420) },
      { name: "Ayase Ueda",         number: 22, position: "FWD", club: "Feyenoord",             age: 26, photo: p("5ezc8v1758188908.png") },
      { name: "Koki Ogawa",         number: 24, position: "FWD", club: "NEC Nijmegen",          age: 26, photo: p("8lo6s51759758672.png") },
      { name: "Keisuke Goto",       number: 25, position: "FWD", club: "Sint-Truidense VV",     age: 22, photo: p("ek0h0b1767196386.png") },
      { name: "Kento Shiogai",      number: 26, position: "FWD", club: "Wolfsburg",             age: 24, photo: p("q2sfl91764537536.png") },
    ],
  },

  // ─── South Korea ──────────────────────────────────────────────────────────
  KOR: {
    coach: "Hong Myung-bo",
    players: [
      { name: "Kim Seung-gyu",    number: 1,  position: "GK",  club: "FC Tokyo",                 age: 35, photo: p("32ktx81668684378.png") },
      { name: "Jo Hyeon-woo",     number: 12, position: "GK",  club: "Ulsan HD FC",              age: 34, photo: p("v7na7c1750221952.png") },
      { name: "Song Bum-keun",    number: 23, position: "GK",  club: "Jeonbuk Hyundai Motors",   age: 28, photo: p("70o5p21668289243.png") },
      { name: "Kim Min-jae",      number: 2,  position: "DEF", club: "Bayern Munich",            age: 29, photo: p("m4uh701756408877.png") },
      { name: "Cho Yu-min",       number: 3,  position: "DEF", club: "Al Sharjah",               age: 29, photo: p("qp523b1668774294.png") },
      { name: "Lee Han-beom",     number: 4,  position: "DEF", club: "FC Midtjylland",           age: 23, photo: p("mzl0v11765385562.png") },
      { name: "Kim Tae-hyeon",    number: 5,  position: "DEF", club: "Kashima Antlers",          age: 25, photo: s(2508546) },
      { name: "Park Jin-seob",    number: 6,  position: "DEF", club: "Zhejiang FC",              age: 30, photo: s(1026069) },
      { name: "Lee Gi-hyuk",      number: 7,  position: "DEF", club: "Gangwon FC",               age: 24, photo: s(1104925) },
      { name: "Lee Tae-seok",     number: 8,  position: "DEF", club: "Austria Wien",             age: 23, photo: p("izwufl1768860032.png") },
      { name: "Seol Young-woo",   number: 9,  position: "DEF", club: "FK Crvena zvezda",         age: 27, photo: s(1019333) },
      { name: "Jens Castrop",     number: 10, position: "DEF", club: "Borussia Mönchengladbach", age: 22, photo: p("ch3tcs1756313858.png") },
      { name: "Kim Moon-hwan",    number: 11, position: "DEF", club: "Daejeon Hana Citizen",     age: 30, photo: p("eufzv71647866451.png") },
      { name: "Kim Jin-gyu",      number: 13, position: "MID", club: "Jeonbuk Hyundai Motors",   age: 29, photo: s(1009476) },
      { name: "Bae Jun-ho",       number: 14, position: "MID", club: "Stoke City",               age: 22, photo: p("mj5ala1761251077.png") },
      { name: "Paik Seung-ho",    number: 15, position: "MID", club: "Birmingham City",          age: 29, photo: p("bsuxra1761931407.png") },
      { name: "Yang Hyun-jun",    number: 16, position: "MID", club: "Celtic",                   age: 23, photo: s(1103531) },
      { name: "Eom Ji-sung",      number: 17, position: "MID", club: "Swansea City",             age: 23, photo: p("q607s71761234673.png") },
      { name: "Lee Kang-in",      number: 18, position: "MID", club: "Paris Saint-Germain",      age: 25, photo: p("3jhw2d1766335293.png") },
      { name: "Lee Dong-gyeong",  number: 19, position: "MID", club: "Ulsan HD FC",              age: 28, photo: s(932316) },
      { name: "Lee Jae-sung",     number: 20, position: "MID", club: "Mainz 05",                 age: 33, photo: p("p0i9wg1763554091.png") },
      { name: "Hwang In-beom",    number: 21, position: "MID", club: "Feyenoord",                age: 29, photo: p("23anvf1764361319.png") },
      { name: "Hwang Hee-chan",    number: 22, position: "MID", club: "Wolverhampton Wanderers",  age: 30, photo: p("917hke1756975302.png") },
      { name: "Son Heung-min",    number: 24, position: "FWD", club: "Los Angeles FC",           age: 33, captain: true, photo: p("a5cqf81766425262.png") },
      { name: "Oh Hyeon-gyu",     number: 25, position: "FWD", club: "Besiktas",                 age: 24, photo: p("afjq841767641921.png") },
      { name: "Cho Gue-sung",     number: 26, position: "FWD", club: "FC Midtjylland",           age: 28, photo: p("32w5vj1765385403.png") },
    ],
  },

  // ─── Sweden ───────────────────────────────────────────────────────────────
  SWE: {
    coach: "Graham Potter",
    players: [
      { name: "Viktor Johansson",         number: 1,  position: "GK",  club: "Stoke City",          age: 27, photo: p("jxtv4m1761251281.png") },
      { name: "Kristoffer Nordfeldt",     number: 12, position: "GK",  club: "AIK Solna",           age: 36, photo: p("e9it0y1717528183.png") },
      { name: "Jacob Widell Zetterström", number: 23, position: "GK",  club: "Derby County",        age: 24, photo: p("4nj3w31761924491.png") },
      { name: "Hjalmar Ekdal",            number: 2,  position: "DEF", club: "Burnley",             age: 24, photo: p("odq06b1757174440.png") },
      { name: "Gabriel Gudmundsson",      number: 3,  position: "DEF", club: "Leeds United",        age: 26, photo: p("d1q18t1757075757.png") },
      { name: "Isak Hien",                number: 4,  position: "DEF", club: "Atalanta",            age: 25, photo: p("ed5d0g1731837971.png") },
      { name: "Emil Holm",                number: 5,  position: "DEF", club: "Juventus",            age: 24, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Emil_Holm_%28Sweden_vs_Moldova%2C_12_October_2023%29.jpg/330px-Emil_Holm_%28Sweden_vs_Moldova%2C_12_October_2023%29.jpg" },
      { name: "Gustaf Lagerbielke",       number: 6,  position: "DEF", club: "Braga",               age: 25, photo: p("3sbqva1726607896.png") },
      { name: "Victor Nilsson Lindelöf",  number: 7,  position: "DEF", club: "Aston Villa",         age: 31, photo: p("07mdel1756984093.png") },
      { name: "Eric Smith",               number: 8,  position: "DEF", club: "St. Pauli",           age: 29, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/2025-04-23_-_FC_St_Pauli_-_Eric_Smith.jpg/330px-2025-04-23_-_FC_St_Pauli_-_Eric_Smith.jpg" },
      { name: "Carl Starfelt",            number: 9,  position: "DEF", club: "Celta Vigo",          age: 30, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Carl_Starfelt_2020.jpg/330px-Carl_Starfelt_2020.jpg" },
      { name: "Elliot Stroud",            number: 10, position: "DEF", club: "Mjällby AIF",         age: 23, photo: p("9u94c51718821528.png") },
      { name: "Daniel Svensson",          number: 11, position: "DEF", club: "Borussia Dortmund",   age: 24, photo: p("q4wdbj1756326141.png") },
      { name: "Taha Ali",                 number: 13, position: "MID", club: "Malmö FF",            age: 27, photo: p("5sfzfi1719482966.png") },
      { name: "Yasin Ayari",              number: 14, position: "MID", club: "Brighton",            age: 22, photo: p("xah7d91756994132.png") },
      { name: "Lucas Bergvall",           number: 15, position: "MID", club: "Tottenham Hotspur",   age: 20, photo: p("6hbkx51757016291.png") },
      { name: "Alexander Bernhardsson",   number: 16, position: "MID", club: "Holstein Kiel",       age: 27, photo: p("7mbysc1773149991.png") },
      { name: "Jesper Karlström",         number: 17, position: "MID", club: "Udinese",             age: 30, photo: p("r1owct1764172392.png") },
      { name: "Benjamin Nygren",          number: 18, position: "MID", club: "Celtic",              age: 24, photo: s(918517) },
      { name: "Ken Sema",                 number: 19, position: "MID", club: "Pafos FC",            age: 31, photo: p("bzntqf1694521940.png") },
      { name: "Mattias Svanberg",         number: 20, position: "MID", club: "Wolfsburg",           age: 27, photo: p("k8h06w1763669622.png") },
      { name: "Besfort Zeneli",           number: 21, position: "MID", club: "Union SG",            age: 23, photo: p("z6kdc01717844452.png") },
      { name: "Anthony Elanga",           number: 22, position: "FWD", club: "Newcastle United",    age: 23, photo: p("zptapf1770796138.png") },
      { name: "Viktor Gyökeres",          number: 24, position: "FWD", club: "Arsenal",             age: 27, captain: true, photo: p("ubnx241769330610.png") },
      { name: "Alexander Isak",           number: 25, position: "FWD", club: "Liverpool",           age: 26, photo: p("3qj7z41757088281.png") },
      { name: "Gustaf Nilsson",           number: 26, position: "FWD", club: "Club Brugge",         age: 28, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Gustaf_Nilsson_USG_2023.jpg/330px-Gustaf_Nilsson_USG_2023.jpg" },
    ],
  },

  // ─── Bosnia and Herzegovina ───────────────────────────────────────────────
  BIH: {
    coach: "Sergej Barbarez",
    players: [
      { name: "Nikola Vasilj",          number: 1,  position: "GK",  club: "FC St. Pauli",             age: 31, photo: p("85qp2e1763567779.png") },
      { name: "Martin Zlomislić",       number: 12, position: "GK",  club: "HNK Rijeka",               age: 28, photo: s(885719) },
      { name: "Osman Hadžikić",         number: 23, position: "GK",  club: "Slaven Belupo",            age: 29, photo: s(352394) },
      { name: "Sead Kolašinac",         number: 2,  position: "DEF", club: "Atalanta",                 age: 32, photo: p("ae2jmk1695157289.png") },
      { name: "Amar Dedić",             number: 3,  position: "DEF", club: "SL Benfica",               age: 22, photo: p("3qhv951758216357.png") },
      { name: "Nihad Mujakić",          number: 4,  position: "DEF", club: "Gaziantep FK",             age: 25, photo: s(858004) },
      { name: "Nikola Katić",           number: 5,  position: "DEF", club: "FC Schalke 04",            age: 29, photo: p("tnvi3o1773611092.png") },
      { name: "Tarik Muharemović",      number: 6,  position: "DEF", club: "US Sassuolo",              age: 22, photo: p("zrpkc31764106120.png") },
      { name: "Stjepan Radeljić",       number: 7,  position: "DEF", club: "HNK Rijeka",               age: 26, photo: s(843746) },
      { name: "Dennis Hadžikadunić",    number: 8,  position: "DEF", club: "UC Sampdoria",             age: 25, photo: p("sz222f1678829240.png") },
      { name: "Nidal Čelik",            number: 9,  position: "DEF", club: "RC Lens",                  age: 24, photo: s(1399503) },
      { name: "Amir Hadžiahmetović",    number: 10, position: "MID", club: "Hull City",                age: 27, photo: p("d701ms1761922073.png") },
      { name: "Ivan Šunjić",            number: 11, position: "MID", club: "Pafos FC",                 age: 30, photo: p("13uqrz1694550036.png") },
      { name: "Ivan Bašić",             number: 13, position: "MID", club: "FC Astana",                age: 28, photo: p("247gi31726000720.png") },
      { name: "Dzenis Burnić",          number: 14, position: "MID", club: "Karlsruher SC",            age: 27, photo: p("mohhc51773244613.png") },
      { name: "Ermin Mahmić",           number: 15, position: "MID", club: "Slovan Liberec",           age: 25, photo: s(1149353) },
      { name: "Benjamin Tahirović",     number: 16, position: "MID", club: "Brøndby IF",               age: 22, photo: p("wrr6m21765376681.png") },
      { name: "Amar Memić",             number: 17, position: "MID", club: "Viktoria Plzeň",           age: 26, photo: s(1129610) },
      { name: "Kerim Alajbegović",      number: 18, position: "MID", club: "RB Salzburg",              age: 21, photo: p("sfkv2p1769721901.png") },
      { name: "Esmir Bajraktarević",    number: 19, position: "MID", club: "PSV Eindhoven",            age: 21, photo: p("896xbs1764594499.png") },
      { name: "Ermedin Demirović",      number: 20, position: "FWD", club: "VfB Stuttgart",            age: 27, photo: p("hvuj8v1763586169.png") },
      { name: "Jovo Lukić",             number: 21, position: "FWD", club: "Universitatea Cluj",       age: 23, photo: p("finvmi1721292254.png") },
      { name: "Samed Baždar",           number: 22, position: "FWD", club: "Jagiellonia Białystok",    age: 27, photo: s(1100965) },
      { name: "Haris Tabaković",        number: 24, position: "FWD", club: "Borussia Mönchengladbach", age: 29, photo: p("rjvats1756313128.png") },
      { name: "Edin Džeko",             number: 25, position: "FWD", club: "FC Schalke 04",            age: 40, captain: true, photo: p("0jo14d1773611434.png") },
      { name: "Emir Smajić",            number: 26, position: "FWD", club: "HNK Rijeka",               age: 24, photo: s(139658) },
    ],
  },

  // ─── Ivory Coast ──────────────────────────────────────────────────────────
  CIV: {
    coach: "Emerse Faé",
    players: [
      { name: "Yahia Fofana",      number: 1,  position: "GK",  club: "Çaykur Rizespor",   age: 25, photo: p("np4wf61765835758.png") },
      { name: "Mohamed Koné",      number: 12, position: "GK",  club: "Charleroi",          age: 24, photo: p("u00n3v1767730751.png") },
      { name: "Alban Lafont",      number: 23, position: "GK",  club: "Panathinaikos",      age: 27, photo: p("pe0pkz1678357707.png") },
      { name: "Emmanuel Agbadou",  number: 2,  position: "DEF", club: "Beşiktaş",           age: 28, photo: p("vwlqq91756975538.png") },
      { name: "Clément Akpa",      number: 3,  position: "DEF", club: "AJ Auxerre",         age: 24, photo: p("vwlxdt1765920817.png") },
      { name: "Ousmane Diomande",  number: 4,  position: "DEF", club: "Sporting CP",        age: 22, photo: p("5y2hc11762291059.png") },
      { name: "Guéla Doué",        number: 5,  position: "DEF", club: "RC Strasbourg",      age: 23, photo: p("l18qe01766402363.png") },
      { name: "Ghislain Konan",    number: 6,  position: "DEF", club: "Gil Vicente",        age: 30, photo: p("rj1ph21608638246.png") },
      { name: "Odilon Kossounou",  number: 7,  position: "DEF", club: "Atalanta",           age: 25, photo: p("p876cf1764331393.png") },
      { name: "Evan Ndicka",       number: 8,  position: "DEF", club: "AS Roma",            age: 26, photo: p("8ark361758816299.png") },
      { name: "Wilfried Singo",    number: 9,  position: "DEF", club: "Galatasaray",        age: 25, photo: p("zwfgmo1769177983.png") },
      { name: "Seko Fofana",       number: 10, position: "MID", club: "FC Porto",           age: 30, photo: p("hu70nu1766137589.png") },
      { name: "Parfait Guiagon",   number: 11, position: "MID", club: "Charleroi",          age: 25, photo: p("y6ivqh1767730682.png") },
      { name: "Christ Oulaï",      number: 13, position: "MID", club: "Trabzonspor",        age: 20, photo: s(1888002) },
      { name: "Franck Kessié",     number: 14, position: "MID", club: "Al-Ahli",            age: 29, captain: true, photo: p("wcmpma1771663848.png") },
      { name: "Ibrahim Sangaré",   number: 15, position: "MID", club: "Nottingham Forest",  age: 28, photo: p("qc7kcv1757163183.png") },
      { name: "Jean-Michaël Seri", number: 16, position: "MID", club: "NK Maribor",         age: 34, photo: p("hlszmt1694794523.png") },
      { name: "Simon Adingra",     number: 17, position: "FWD", club: "Monaco",             age: 24, photo: p("rxw49v1762198657.png") },
      { name: "Ange-Yoan Bonny",   number: 18, position: "FWD", club: "Inter Milan",        age: 21, photo: p("d7uly91759408116.png") },
      { name: "Amad Diallo",       number: 19, position: "FWD", club: "Manchester United",  age: 23, photo: p("8p6wbg1766826668.png") },
      { name: "Oumar Diakité",     number: 20, position: "FWD", club: "Cercle Brugge",      age: 22, photo: p("2s5slh1767799799.png") },
      { name: "Yan Diomandé",      number: 21, position: "FWD", club: "RB Leipzig",         age: 19, photo: p("zbzyn51763561086.png") },
      { name: "Evann Guessand",    number: 22, position: "FWD", club: "Crystal Palace",     age: 24, photo: p("x99loi1772141649.png") },
      { name: "Nicolas Pépé",      number: 24, position: "FWD", club: "Villarreal",         age: 30, photo: p("xeui221762889301.png") },
      { name: "Bazoumana Touré",   number: 25, position: "FWD", club: "TSG Hoffenheim",     age: 20, photo: p("sf2uwx1763494642.png") },
      { name: "Elye Wahi",         number: 26, position: "FWD", club: "OGC Nice",           age: 23, photo: p("uuqh371762287642.png") },
    ],
  },

  // ─── Tunisia ──────────────────────────────────────────────────────────────
  TUN: {
    coach: "Sabri Lamouchi",
    players: [
      { name: "Aymen Dahmen",        number: 1,  position: "GK",  club: "CS Sfaxien",          age: 29, photo: p("x3irao1669130503.png") },
      { name: "Sabri Ben Hessen",   number: 12, position: "GK",  club: "Étoile du Sahel",     age: 29, photo: s(359312) },
      { name: "Abdelmouhib Chamakh",   number: 23, position: "GK",  club: "Club Africain",       age: 26, photo: s(2018130) },
      { name: "Montassar Talbi",     number: 2,  position: "DEF", club: "Lorient",             age: 27, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Montassar_Talbi_2021.jpg/330px-Montassar_Talbi_2021.jpg" },
      { name: "Dylan Bronn",         number: 3,  position: "DEF", club: "Servette",            age: 29, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Dylan_Bronn_2.jpg/330px-Dylan_Bronn_2.jpg" },
      { name: "Omar Rekik",          number: 4,  position: "DEF", club: "NK Maribor",          age: 24, photo: s(976251) },
      { name: "Yan Valery",          number: 5,  position: "DEF", club: "Young Boys",          age: 26, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Sheffield_Wednesday%27s_Starting_Eleven_18102025_%281%29_%28cropped%29.jpg/330px-Sheffield_Wednesday%27s_Starting_Eleven_18102025_%281%29_%28cropped%29.jpg" },
      { name: "Ali Abdi",            number: 6,  position: "DEF", club: "OGC Nice",            age: 32, photo: s(919027) },
      { name: "Moutaz Neffati",       number: 7,  position: "DEF", club: "IFK Norrköping",      age: 21, photo: s(1391526) },
      { name: "Raed Chikhaoui",      number: 8,  position: "DEF", club: "US Monastir",         age: 21, photo: s(2018330) },
      { name: "Adem Arous",          number: 9,  position: "DEF", club: "Kasımpaşa",           age: 21, photo: s(2018238) },
      { name: "Ellyes Skhiri",       number: 10, position: "MID", club: "Eintracht Frankfurt", age: 30, captain: true, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/2021-08-08_FC_Carl_Zeiss_Jena_gegen_1._FC_K%C3%B6ln_%28DFB-Pokal%29_by_Sandro_Halank%E2%80%93182_%28cropped2%29.jpg/330px-2021-08-08_FC_Carl_Zeiss_Jena_gegen_1._FC_K%C3%B6ln_%28DFB-Pokal%29_by_Sandro_Halank%E2%80%93182_%28cropped2%29.jpg" },
      { name: "Hannibal Mejbri",     number: 11, position: "MID", club: "Burnley",             age: 22, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Hannibal_Mejbri_26042025_%281%29.jpg/330px-Hannibal_Mejbri_26042025_%281%29.jpg" },
      { name: "Amine Ben Hmida",    number: 13, position: "MID", club: "Espérance de Tunis",  age: 30, photo: s(1000809) },
      { name: "Anis Ben Slimane",    number: 14, position: "MID", club: "Norwich City",        age: 25, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/FC_Salzburg_gegen_Br%C3%B8ndby_IF_%28Championsleague_Play_off_Hinspiel_17._August_2021%29_12.jpg/330px-FC_Salzburg_gegen_Br%C3%B8ndby_IF_%28Championsleague_Play_off_Hinspiel_17._August_2021%29_12.jpg" },
      { name: "Mohamed Belhadj Mahmoud", number: 15, position: "MID", club: "FC Lugano",           age: 25, photo: s(1008597) },
      { name: "Rani Khedira",        number: 16, position: "MID", club: "Union Berlin",        age: 32, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Testspiel_Rasenballsport_Leipzig_gegen_FC_Liefering_%289.August_2016%29_36.jpg/330px-Testspiel_Rasenballsport_Leipzig_gegen_FC_Liefering_%289.August_2016%29_36.jpg" },
      { name: "Mortadha Ben Ouanes", number: 17, position: "MID", club: "Kasımpaşa",           age: 31, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Mortadha_Ben_Ouanes.jpg/330px-Mortadha_Ben_Ouanes.jpg" },
      { name: "Elias Achouri",       number: 18, position: "FWD", club: "FC Copenhagen",       age: 23, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Elias_Achouri%2C_Vejle_Boldklub_-_FC_K%C3%B8benhavn%2C_29._July_2023_-_opvarmning_FCK%27s_1._hold_%28cropped%29.jpg/330px-Elias_Achouri%2C_Vejle_Boldklub_-_FC_K%C3%B8benhavn%2C_29._July_2023_-_opvarmning_FCK%27s_1._hold_%28cropped%29.jpg" },
      { name: "Ismaël Gharbi",       number: 19, position: "FWD", club: "FC Augsburg",         age: 21, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Isma%C3%ABl_Gharbi_at_the_PSG-VAFC_game_%28cropped%29.jpg/330px-Isma%C3%ABl_Gharbi_at_the_PSG-VAFC_game_%28cropped%29.jpg" },
      { name: "Elias Saad",          number: 20, position: "FWD", club: "Hannover 96",         age: 26, photo: s(1130946) },
      { name: "Sebastian Tounekti",  number: 21, position: "FWD", club: "Celtic",              age: 23, photo: s(957143) },
      { name: "Firas Chaouat",       number: 22, position: "FWD", club: "Club Africain",       age: 29, photo: s(919198) },
      { name: "Khalil Ayari",        number: 24, position: "FWD", club: "Paris Saint-Germain", age: 21, photo: s(1606568) },
      { name: "Hazem Mastouri",      number: 25, position: "FWD", club: "Dynamo Makhachkala",  age: 28, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Hazem_Mastouri_2026.jpg/330px-Hazem_Mastouri_2026.jpg" },
      { name: "Rayan Elloumi",         number: 26, position: "FWD", club: "Vancouver Whitecaps", age: 21, photo: s(1872950) },
    ],
  },

  // ─── Haiti ────────────────────────────────────────────────────────────────
  HAI: {
    coach: "Marc Collat",
    players: [
      { name: "Johnny Placide",        number: 1,  position: "GK",  club: "SC Bastia",              age: 37, captain: true, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Johny_Placide_in_Tsarsko_selo.jpg/330px-Johny_Placide_in_Tsarsko_selo.jpg" },
      { name: "Alexandre Pierre",      number: 12, position: "GK",  club: "FC Sochaux",             age: 27, photo: s(1091596) },
      { name: "Josué Duverger",        number: 23, position: "GK",  club: "FC Cosmos Koblenz",      age: 25, photo: s(936558) },
      { name: "Carlens Arcus",         number: 2,  position: "DEF", club: "Angers SCO",             age: 27, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/RC_Lens_-_AJ_Auxerre_%2809-03-2019%29_96.jpg/330px-RC_Lens_-_AJ_Auxerre_%2809-03-2019%29_96.jpg" },
      { name: "Wilguens Paugwain",     number: 3,  position: "DEF", club: "SV Zulte Waregem",       age: 26, photo: s(1404526) },
      { name: "Duke Lacroix",          number: 4,  position: "DEF", club: "Colorado Springs",       age: 26, photo: s(884301) },
      { name: "Martin Experience",     number: 5,  position: "DEF", club: "AS Nancy-Lorraine",      age: 28, photo: s(1110369) },
      { name: "Jean-Kevin Duverne",    number: 6,  position: "DEF", club: "KAA Gent",               age: 28, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/RC_Lens_-_FC_Nantes_%2828-10-2023%29_17.jpg/330px-RC_Lens_-_FC_Nantes_%2828-10-2023%29_17.jpg" },
      { name: "Ricardo Adé",           number: 7,  position: "DEF", club: "LDU Quito",              age: 27, photo: s(839638) },
      { name: "Hannes Delcroix",       number: 8,  position: "DEF", club: "FC Lugano",              age: 26, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/FC_Red_Bull_Salzburg_gegen_RSC_Anderlecht_%28Testspiel_7._Juli_2017%29_50.jpg/330px-FC_Red_Bull_Salzburg_gegen_RSC_Anderlecht_%28Testspiel_7._Juli_2017%29_50.jpg" },
      { name: "Keeto Thermoncy",       number: 9,  position: "DEF", club: "BSC Young Boys II",      age: 23, photo: s(1544387) },
      { name: "Leverton Pierre",       number: 10, position: "MID", club: "FC Vizela",              age: 27, photo: s(912050) },
      { name: "Carl-Fred Sainthe",     number: 11, position: "MID", club: "El Paso Locomotive",     age: 26, photo: s(1002387) },
      { name: "Jean-Jacques Danley",   number: 13, position: "MID", club: "Philadelphia Union",     age: 25, photo: s(1173167) },
      { name: "Jeanricner Bellegarde", number: 14, position: "MID", club: "Wolverhampton Wanderers", age: 23, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Lens_B_-_AC_Amiens_%2812-09-2015%29_64_%28cropped%29.JPG/330px-Lens_B_-_AC_Amiens_%2812-09-2015%29_64_%28cropped%29.JPG" },
      { name: "Woodensky Pierre",      number: 15, position: "MID", club: "Violette AC",            age: 25 },
      { name: "Dominique Simon",       number: 16, position: "MID", club: "FC Tatran Prešov",       age: 26, photo: s(1187376) },
      { name: "Louicius Deedson",      number: 17, position: "FWD", club: "FC Dallas",              age: 25, photo: s(991451) },
      { name: "Ruben Providence",      number: 18, position: "FWD", club: "Almere City FC",         age: 24, photo: s(954066) },
      { name: "Josué Casimir",         number: 19, position: "FWD", club: "AJ Auxerre",             age: 24, photo: s(1035986) },
      { name: "Derrick Etienne",       number: 20, position: "FWD", club: "Toronto FC",             age: 31, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Derrick_Etienne_%2828411015376%29_%28cropped2%29.jpg/330px-Derrick_Etienne_%2828411015376%29_%28cropped2%29.jpg" },
      { name: "Wilson Isidor",         number: 21, position: "FWD", club: "Sunderland AFC",         age: 25, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Wilson_Isidor_2022.jpg/330px-Wilson_Isidor_2022.jpg" },
      { name: "Duckens Nazon",         number: 22, position: "FWD", club: "Esteghlal FC",           age: 32, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/2025_Iran_Football_Premier_League_Esteghlal_and_Zob_Ahan_football_match_3_Mehr_%28cropped%29.jpg/330px-2025_Iran_Football_Premier_League_Esteghlal_and_Zob_Ahan_football_match_3_Mehr_%28cropped%29.jpg" },
      { name: "Frantzdy Pierrot",      number: 24, position: "FWD", club: "Çaykur Rizespor",        age: 30, photo: s(943278) },
      { name: "Yassin Fortune",        number: 25, position: "FWD", club: "FC Vizela",              age: 24, photo: s(826211) },
      { name: "Lenny Joseph",          number: 26, position: "FWD", club: "Ferencváros TC",         age: 25, photo: s(1010126) },
    ],
  },

  // ─── New Zealand ──────────────────────────────────────────────────────────
  NZL: {
    coach: "Darren Bazeley",
    players: [
      { name: "Max Crocombe",      number: 1,  position: "GK",  club: "Millwall",              age: 32, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Max_Crocombe_290425.jpg/330px-Max_Crocombe_290425.jpg" },
      { name: "Alex Paulsen",      number: 12, position: "GK",  club: "Lechia Gdańsk",         age: 26, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Alex_Paulsen.jpg/330px-Alex_Paulsen.jpg" },
      { name: "Michael Woud",      number: 23, position: "GK",  club: "Auckland FC",           age: 27, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Michael_Woud.jpg/330px-Michael_Woud.jpg" },
      { name: "Tyler Bindon",      number: 2,  position: "DEF", club: "Nottingham Forest",     age: 22, photo: s(1514870) },
      { name: "Michael Boxall",    number: 3,  position: "DEF", club: "Minnesota United",      age: 35, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Michael_Boxall_-_MNUFC_-_MLS_-_new_zealand_-_%2852125271279%29.jpg/330px-Michael_Boxall_-_MNUFC_-_MLS_-_new_zealand_-_%2852125271279%29.jpg" },
      { name: "Liberato Cacace",   number: 4,  position: "DEF", club: "Wrexham",               age: 25, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Liberato_Cacace_30082025_%281%29.jpg/330px-Liberato_Cacace_30082025_%281%29.jpg" },
      { name: "Francis de Vries",  number: 5,  position: "DEF", club: "Auckland FC",           age: 22, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Francis_de_Vries.jpg/330px-Francis_de_Vries.jpg" },
      { name: "Callan Elliot",     number: 6,  position: "DEF", club: "Auckland FC",           age: 21, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Callan_Elliot.jpg/330px-Callan_Elliot.jpg" },
      { name: "Tim Payne",         number: 7,  position: "DEF", club: "Wellington Phoenix",    age: 28, photo: s(155882) },
      { name: "Nando Pijnaker",    number: 8,  position: "DEF", club: "Auckland FC",           age: 29, photo: s(982371) },
      { name: "Tommy Smith",       number: 9,  position: "DEF", club: "Braintree Town",        age: 36, photo: s(38111) },
      { name: "Finn Surman",       number: 10, position: "DEF", club: "Portland Timbers",      age: 24, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Finn_Surman.jpg/330px-Finn_Surman.jpg" },
      { name: "Lachlan Bayliss",   number: 11, position: "MID", club: "Newcastle Jets",        age: 23, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Lachlan_Bayliss.jpg/330px-Lachlan_Bayliss.jpg" },
      { name: "Joe Bell",          number: 13, position: "MID", club: "Viking FK",             age: 27, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Joe_Bell_2023.jpg/330px-Joe_Bell_2023.jpg" },
      { name: "Matt Garbett",      number: 14, position: "MID", club: "Peterborough United",   age: 27, photo: s(1002607) },
      { name: "Ben Old",           number: 15, position: "MID", club: "Saint-Étienne",         age: 24, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Old_asse_psg_2425.png/330px-Old_asse_psg_2425.png" },
      { name: "Alex Rufer",        number: 16, position: "MID", club: "Wellington Phoenix",    age: 30, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Alex_Rufer.jpg/330px-Alex_Rufer.jpg" },
      { name: "Sarpreet Singh",    number: 17, position: "MID", club: "Wellington Phoenix",    age: 26, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Sarpreet_Singh_Training_2019-07-28_FC_Bayern_Munich.png/330px-Sarpreet_Singh_Training_2019-07-28_FC_Bayern_Munich.png" },
      { name: "Marko Stamenic",    number: 18, position: "MID", club: "Swansea City",          age: 24, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/FC_Zenit_Saint_Petersburg_vs._Red_Star_Belgrade%2C_4_July_2023_%2850%29.jpg/330px-FC_Zenit_Saint_Petersburg_vs._Red_Star_Belgrade%2C_4_July_2023_%2850%29.jpg" },
      { name: "Ryan Thomas",       number: 19, position: "MID", club: "PEC Zwolle",            age: 30, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Ryan_Jared_Thomas.jpg/330px-Ryan_Jared_Thomas.jpg" },
      { name: "Kosta Barbarouses", number: 20, position: "FWD", club: "Western Sydney W.",     age: 36, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Kosta_Barbarousas_Training.JPG/330px-Kosta_Barbarousas_Training.JPG" },
      { name: "Eli Just",          number: 21, position: "FWD", club: "Motherwell",            age: 24, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Elijah_Just.jpg/330px-Elijah_Just.jpg" },
      { name: "Callum McCowatt",   number: 22, position: "FWD", club: "Silkeborg",             age: 27, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Callum_McCowatt_playing_for_New_Zealand%2C_26_March_2023_%282%29_%28cropped%29.jpg/330px-Callum_McCowatt_playing_for_New_Zealand%2C_26_March_2023_%282%29_%28cropped%29.jpg" },
      { name: "Jesse Randall",     number: 24, position: "FWD", club: "Auckland FC",           age: 23, photo: s(1002506) },
      { name: "Ben Waine",         number: 25, position: "FWD", club: "Port Vale",             age: 24, photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Ben_Waine.jpg/330px-Ben_Waine.jpg" },
      { name: "Chris Wood",        number: 26, position: "FWD", club: "Nottingham Forest",     age: 34, captain: true, photo: s(50480) },
    ],
  },

};
