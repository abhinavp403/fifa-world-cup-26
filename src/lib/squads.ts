// World Cup 2026 squad data — tournament stats only.
// All stats start at 0 and update once matches begin.

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
  stats?:    PlayerStats; // populated once the tournament begins
};

export type Squad = {
  coach:   string;
  players: SquadPlayer[];
};

export const SQUADS: Record<string, Squad> = {
  // ─── France ───────────────────────────────────────────────────────────────
  FRA: {
    coach: "Didier Deschamps",
    players: [
      // Goalkeepers
      { name: "Mike Maignan",        number: 1,  position: "GK",  club: "AC Milan",              age: 30, photo: "https://r2.thesportsdb.com/images/media/player/cutout/sw5ukh1758892671.png" },
      { name: "Alphonse Areola",     number: 16, position: "GK",  club: "West Ham United",        age: 32, photo: "https://r2.thesportsdb.com/images/media/player/cutout/istdrx1756985080.png" },
      { name: "Brice Samba",         number: 23, position: "GK",  club: "RC Lens",                age: 31, photo: "https://r2.thesportsdb.com/images/media/player/cutout/nkfugp1766137864.png" },
      // Defenders
      { name: "Benjamin Pavard",     number: 2,  position: "DEF", club: "Inter Milan",            age: 30, photo: "https://r2.thesportsdb.com/images/media/player/cutout/d9p3381766153512.png" },
      { name: "Jules Koundé",        number: 5,  position: "DEF", club: "FC Barcelona",           age: 28, photo: "https://r2.thesportsdb.com/images/media/player/cutout/qea88i1726509803.png" },
      { name: "Dayot Upamecano",     number: 4,  position: "DEF", club: "Bayern Munich",          age: 27, photo: "https://r2.thesportsdb.com/images/media/player/cutout/a1hyfj1756416177.png" },
      { name: "William Saliba",      number: 17, position: "DEF", club: "Arsenal",                age: 25, photo: "https://r2.thesportsdb.com/images/media/player/cutout/czasy21769331889.png" },
      { name: "Ibrahima Konaté",     number: 15, position: "DEF", club: "Liverpool",              age: 26, photo: "https://r2.thesportsdb.com/images/media/player/cutout/izock91757088476.png" },
      { name: "Théo Hernandez",      number: 22, position: "DEF", club: "AC Milan",               age: 28, photo: "https://r2.thesportsdb.com/images/media/player/cutout/4d3g7j1675234242.png" },
      { name: "Lucas Hernandez",     number: 3,  position: "DEF", club: "Paris Saint-Germain",    age: 29, photo: "https://r2.thesportsdb.com/images/media/player/cutout/2ugny71766335261.png" },
      { name: "Ferland Mendy",       number: 20, position: "DEF", club: "Real Madrid",            age: 30, photo: "https://r2.thesportsdb.com/images/media/player/cutout/3kzpr31733653604.png" },
      // Midfielders
      { name: "Aurélien Tchouaméni", number: 8,  position: "MID", club: "Real Madrid",            age: 26, photo: "https://r2.thesportsdb.com/images/media/player/cutout/4o417k1733653668.png" },
      { name: "Eduardo Camavinga",   number: 6,  position: "MID", club: "Real Madrid",            age: 23, photo: "https://r2.thesportsdb.com/images/media/player/cutout/viijpx1733653403.png" },
      { name: "N'Golo Kanté",        number: 13, position: "MID", club: "Al-Ittihad",             age: 35, photo: "https://r2.thesportsdb.com/images/media/player/cutout/ld6low1719039995.png" },
      { name: "Youssouf Fofana",     number: 14, position: "MID", club: "AC Milan",               age: 26, photo: "https://r2.thesportsdb.com/images/media/player/cutout/3npg7a1758892447.png" },
      { name: "Warren Zaïre-Emery",  number: 18, position: "MID", club: "Paris Saint-Germain",    age: 20, photo: "https://r2.thesportsdb.com/images/media/player/cutout/fjxbac1766335583.png" },
      { name: "Adrien Rabiot",       number: 24, position: "MID", club: "Olympique de Marseille", age: 31, photo: "https://r2.thesportsdb.com/images/media/player/cutout/m2upnx1758893486.png" },
      { name: "Khéphren Thuram",     number: 25, position: "MID", club: "Juventus",               age: 23, photo: "https://r2.thesportsdb.com/images/media/player/cutout/z7zq751759225259.png" },
      { name: "Mattéo Guendouzi",    number: 26, position: "MID", club: "Olympique de Marseille", age: 26, photo: "https://r2.thesportsdb.com/images/media/player/cutout/tcelg91769179721.png" },
      // Forwards
      { name: "Kylian Mbappé",       number: 10, position: "FWD", club: "Real Madrid",            age: 27, captain: true, photo: "https://r2.thesportsdb.com/images/media/player/cutout/h9u9vz1733653583.png" },
      { name: "Marcus Thuram",       number: 9,  position: "FWD", club: "Inter Milan",            age: 28, photo: "https://r2.thesportsdb.com/images/media/player/cutout/aykui01759408989.png" },
      { name: "Ousmane Dembélé",     number: 11, position: "FWD", club: "Paris Saint-Germain",    age: 29, photo: "https://r2.thesportsdb.com/images/media/player/cutout/pstgy21766335175.png" },
      { name: "Kingsley Coman",      number: 7,  position: "FWD", club: "Bayern Munich",          age: 30, photo: "https://r2.thesportsdb.com/images/media/player/cutout/bfe40s1770542910.png" },
      { name: "Bradley Barcola",     number: 19, position: "FWD", club: "Paris Saint-Germain",    age: 23, photo: "https://r2.thesportsdb.com/images/media/player/cutout/l2v71f1766334537.png" },
      { name: "Randal Kolo Muani",   number: 21, position: "FWD", club: "Paris Saint-Germain",    age: 27, photo: "https://r2.thesportsdb.com/images/media/player/cutout/h89zyk1768679563.png" },
      { name: "Michael Olise",       number: 12, position: "FWD", club: "Bayern Munich",          age: 23, photo: "https://r2.thesportsdb.com/images/media/player/cutout/r4vx6b1756408807.png" },
    ],
  },
};
