/* eslint-disable @typescript-eslint/ban-ts-comment */
import { getCurrentDate } from './utils/time';
import { Coordinates } from './types';

// ================================================================
// Orbital mechanics utils (heliocentric ecliptic, epoch J2000.0)
// ================================================================

const AU_KM = 149_597_870.7; // kilometers per astronomical unit (IAU)

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

function norm360(deg: number): number {
  let a = deg % 360;
  if (a < 0) a += 360;
  return a;
}

function getJulianDay(date: Date): number {
  // Convert JS epoch (ms since 1970-01-01) to Julian Day
  return date.getTime() / 86400000 + 2440587.5;
}

function centuriesSinceJ2000(date: Date): number {
  const JD = getJulianDay(date);
  return (JD - 2451545.0) / 36525.0;
}

function solveKepler(M: number, e: number): number {
  // Inputs in radians; returns E in radians
  let E = M;
  let delta = 1;
  let iter = 0;
  while (Math.abs(delta) > 1e-8 && iter < 50) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    delta = f / fp;
    E -= delta;
    iter++;
  }
  return E;
}

// Round a date to the nearest hour to stabilize snapshots across frames
function quantizeToSecond(date: Date): Date {
  const t = date.getTime();
  const secondMs = 1000;
  const qt = Math.round(t / secondMs) * secondMs;
  return new Date(qt);
}

// Keplerian elements for heliocentric orbits (J2000 elements; rates for L)
export interface KeplerianElements {
  a: number; // semi-major axis [AU]
  e: number; // eccentricity
  i: number; // inclination [deg]
  L: number; // mean longitude at epoch [deg]
  longPeri: number; // longitude of perihelion (varpi) [deg]
  longNode: number; // longitude of ascending node (Omega) [deg]
  // Optional linear rates per Julian century
  aDot?: number;
  eDot?: number;
  iDot?: number;
  LDot?: number; // deg / century
  longPeriDot?: number; // deg / century
  longNodeDot?: number; // deg / century
}

// Simple satellite orbit around a parent body
export interface SatelliteOrbit {
  semiMajorAxisKm: number; // [km]
  e: number; // eccentricity
  i: number; // inclination to ecliptic [deg]
  longNode: number; // ascending node [deg]
  argPeri: number; // argument of periapsis [deg]
  meanAnomalyAtEpoch: number; // [deg] at epochJd
  meanMotionDegPerDay: number; // [deg/day]
  epochJd?: number; // defaults to J2000.0
}

function heliocentricFromKepler(
  el: KeplerianElements,
  date: Date,
): Coordinates {
  const T = centuriesSinceJ2000(date);

  const a = el.a + (el.aDot ?? 0) * T; // AU
  const e = el.e + (el.eDot ?? 0) * T;
  const iDeg = el.i + (el.iDot ?? 0) * T;
  const LDeg = norm360(el.L + (el.LDot ?? 0) * T);
  const varpiDeg = el.longPeri + (el.longPeriDot ?? 0) * T;
  const OmegaDeg = el.longNode + (el.longNodeDot ?? 0) * T;

  const MDeg = norm360(LDeg - varpiDeg);

  const i = deg2rad(iDeg);
  const Omega = deg2rad(OmegaDeg);
  const omega = deg2rad(varpiDeg - OmegaDeg);
  const M = deg2rad(MDeg);

  const E = solveKepler(M, e);
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const rAu = a * (1 - e * cosE);

  const sqrt1me2 = Math.sqrt(1 - e * e);
  const cosv = (cosE - e) / (1 - e * cosE);
  const sinv = (sqrt1me2 * sinE) / (1 - e * cosE);
  const v = Math.atan2(sinv, cosv);

  const u = omega + v; // argument of latitude

  const cosu = Math.cos(u);
  const sinu = Math.sin(u);
  const cosO = Math.cos(Omega);
  const sinO = Math.sin(Omega);
  const cosi = Math.cos(i);
  const sini = Math.sin(i);

  // heliocentric ecliptic (J2000) in AU
  const xAu = rAu * (cosO * cosu - sinO * sinu * cosi);
  const yAu = rAu * (sinO * cosu + cosO * sinu * cosi);
  const zAu = rAu * (sinu * sini);

  return [xAu * AU_KM, yAu * AU_KM, zAu * AU_KM];
}

function satelliteRelativePosition(
  sat: SatelliteOrbit,
  date: Date,
): Coordinates {
  const epoch = sat.epochJd ?? 2451545.0;
  const d = getJulianDay(date) - epoch;
  const Mdeg = norm360(sat.meanAnomalyAtEpoch + sat.meanMotionDegPerDay * d);
  const M = deg2rad(Mdeg);
  const e = sat.e;
  const E = solveKepler(M, e);
  const r = sat.semiMajorAxisKm * (1 - e * Math.cos(E));

  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const sqrt1me2 = Math.sqrt(1 - e * e);
  const cosv = (cosE - e) / (1 - e * cosE);
  const sinv = (sqrt1me2 * sinE) / (1 - e * cosE);
  const v = Math.atan2(sinv, cosv);

  const i = deg2rad(sat.i);
  const Omega = deg2rad(sat.longNode);
  const omega = deg2rad(sat.argPeri);
  const u = omega + v;

  const cosu = Math.cos(u);
  const sinu = Math.sin(u);
  const cosO = Math.cos(Omega);
  const sinO = Math.sin(Omega);
  const cosi = Math.cos(i);
  const sini = Math.sin(i);

  const x = r * (cosO * cosu - sinO * sinu * cosi);
  const y = r * (sinO * cosu + cosO * sinu * cosi);
  const z = r * (sinu * sini);
  return [x, y, z];
}

/**
 * Short for celestial body
 */
export interface CBody {
  name: string;
  description: string;
  color: number;
  radiusKm: number;

  getPosition(date?: Date): Coordinates;
}

interface BaseCBodyOptions {
  name: string;
  description: string;
  radiusKm: number;
}

interface PlanetOptions extends BaseCBodyOptions {
  color: number;
  orbitalPeriodDays: number;
  kepler: KeplerianElements; // heliocentric elements (required for planets)
  minLevel?: number; // if present, planet is landable
}

interface MoonOptions extends BaseCBodyOptions {
  color: number;
  orbitalPeriodDays: number;
  orbits: HelioName; // parent planet name
  satellite: SatelliteOrbit; // required for moons
  orbitOffsetMultiplier?: number;
  minLevel: number; // moons are always landable
}

interface StarOptions extends BaseCBodyOptions {
  color?: number;
  position: Coordinates;
}

export class Planet implements CBody {
  public name: string;
  public description: string;
  public color: number;
  public radiusKm: number;
  public orbitalPeriodDays: number;
  public kepler: KeplerianElements;
  public minLevel?: number;

  constructor(options: PlanetOptions) {
    this.name = options.name;
    this.description = options.description;
    this.color = options.color;
    this.radiusKm = options.radiusKm;
    this.orbitalPeriodDays = options.orbitalPeriodDays;
    this.kepler = options.kepler;
    this.minLevel = options.minLevel;
  }

  getPosition(date?: Date): Coordinates {
    // Quantize to nearest second
    const dRaw = date ?? getCurrentDate();
    const d = quantizeToSecond(dRaw);
    // Primary around Sun via Keplerian elements
    const coords = heliocentricFromKepler(this.kepler, d);
    return coords;
  }

  get isLandable(): boolean {
    return this.minLevel !== undefined;
  }
}

export class Moon implements CBody {
  public name: string;
  public description: string;
  public color: number;
  public radiusKm: number;
  public orbitalPeriodDays: number;
  public orbits: HelioName;
  public satellite: SatelliteOrbit;
  public orbitOffsetMultiplier?: number;
  public minLevel: number; // moons are always landable

  constructor(options: MoonOptions) {
    this.name = options.name;
    this.description = options.description;
    this.color = options.color;
    this.radiusKm = options.radiusKm;
    this.orbitalPeriodDays = options.orbitalPeriodDays;
    this.orbits = options.orbits;
    this.satellite = options.satellite;
    this.orbitOffsetMultiplier = options.orbitOffsetMultiplier;
    this.minLevel = options.minLevel;
  }

  getPosition(date?: Date): Coordinates {
    const dRaw = date ?? getCurrentDate();
    const d = quantizeToSecond(dRaw);
    const parent = cBodies.find((b) => b.name === this.orbits);
    if (!parent || !(parent instanceof Planet)) {
      throw new Error(`Parent body ${this.orbits} not found for ${this.name}`);
    }
    const parentPos: Coordinates = parent.getPosition(d);
    const rel = satelliteRelativePosition(this.satellite, d);
    return [
      parentPos[0] + rel[0],
      parentPos[1] + rel[1],
      parentPos[2] + rel[2],
    ];
  }

  get isLandable(): boolean {
    return true;
  }
}

export class Star implements CBody {
  public name: string;
  public description: string;
  private position: Coordinates;
  public color: number;
  public radiusKm: number;

  constructor(options: StarOptions) {
    this.name = options.name;
    this.description = options.description;
    this.color = options.color ?? 0xfff700;
    this.position = options.position;
    this.radiusKm = options.radiusKm;
  }

  getPosition() {
    return this.position;
  }
}

export const sun = new Star({
  name: 'Sun',
  description: 'The star at the center of our solar system',
  position: [0, 0, 0],
  radiusKm: 696340,
});
// ----------------------------------------
// Heliocentric Keplerian elements (J2000)
// LDot values from JPL approximations (deg/century); others held fixed.
// These produce reasonably accurate positions for visualization.
const HELIO = {
  Mercury: {
    a: 0.38709893,
    e: 0.20563069,
    i: 7.00487,
    L: 252.25084,
    longPeri: 77.45645,
    longNode: 48.33167,
    LDot: 149472.67411175,
  },
  Venus: {
    a: 0.72333199,
    e: 0.00677323,
    i: 3.39471,
    L: 181.97973,
    longPeri: 131.53298,
    longNode: 76.68069,
    LDot: 58517.81538729,
  },
  Earth: {
    a: 1.00000011,
    e: 0.01671022,
    i: 0.00005,
    L: 100.46435,
    longPeri: 102.94719,
    longNode: -11.26064, // ~348.73936 mod 360
    LDot: 35999.37244981,
  },
  Mars: {
    a: 1.52366231,
    e: 0.09341233,
    i: 1.85061,
    L: 355.45332,
    longPeri: 336.04084,
    longNode: 49.57854,
    LDot: 19140.30268499,
  },
  Jupiter: {
    a: 5.20336301,
    e: 0.04839266,
    i: 1.3053,
    L: 34.40438,
    longPeri: 14.75385,
    longNode: 100.55615,
    LDot: 3034.90371757,
  },
  Saturn: {
    a: 9.53707032,
    e: 0.0541506,
    i: 2.48446,
    L: 49.94432,
    longPeri: 92.43194,
    longNode: 113.71504,
    LDot: 1222.11451204,
  },
  Uranus: {
    a: 19.19126393,
    e: 0.04716771,
    i: 0.76986,
    L: 313.23218,
    longPeri: 170.96424,
    longNode: 74.22988,
    LDot: 428.49512562,
  },
  Neptune: {
    a: 30.06896348,
    e: 0.00858587,
    i: 1.76917,
    L: 304.88003,
    longPeri: 44.97135,
    longNode: 131.72169,
    LDot: 218.46515314,
  },
  Pluto: {
    a: 39.48168677,
    e: 0.24880766,
    i: 17.14175,
    L: 238.92881,
    longPeri: 224.06676,
    longNode: 110.30347,
    LDot: 145.20780515,
  },
} satisfies Record<string, KeplerianElements>;

export type HelioName = keyof typeof HELIO;

export const earth = new Planet({
  name: 'Earth',
  description: 'Home sweet home',
  color: 0x6b93d6,
  radiusKm: 6371,
  orbitalPeriodDays: 365.256,
  kepler: HELIO.Earth,
  minLevel: 1,
});
export const moon = new Moon({
  name: 'The Moon',
  description: 'Our celestial companion',
  color: 0xc0c0c0,
  radiusKm: 1737.4,
  orbitalPeriodDays: 27.321661,
  orbits: 'Earth',
  // Approximate lunar orbit relative to the ecliptic (very simplified)
  satellite: {
    semiMajorAxisKm: 384_400,
    e: 0.0549,
    i: 5.145,
    longNode: 125.08,
    argPeri: 318.15,
    meanAnomalyAtEpoch: 115.3654,
    meanMotionDegPerDay: 360 / 27.321661,
  },
  minLevel: 1,
});
export const mercury = new Planet({
  name: 'Mercury',
  description: 'Closest planet to the Sun',
  color: 0x8c7853,
  radiusKm: 2439.7,
  orbitalPeriodDays: 87.969,
  kepler: HELIO.Mercury,
  minLevel: 1,
});
export const venus = new Planet({
  name: 'Venus',
  description: 'The morning star',
  color: 0xffc649,
  radiusKm: 6051.8,
  orbitalPeriodDays: 224.701,
  kepler: HELIO.Venus,
  minLevel: 1,
});
export const mars = new Planet({
  name: 'Mars',
  description: 'The Red Planet',
  color: 0xcd5c5c,
  radiusKm: 3389.5,
  orbitalPeriodDays: 686.98,
  kepler: HELIO.Mars,
  minLevel: 1,
});
export const jupiter = new Planet({
  name: 'Jupiter',
  description: 'The largest planet in our solar system',
  color: 0xd8ca9d,
  radiusKm: 69911,
  orbitalPeriodDays: 4332.589,
  kepler: HELIO.Jupiter,
});
export const saturn = new Planet({
  name: 'Saturn',
  description: 'The ringed planet',
  color: 0xfad5a5,
  radiusKm: 58232,
  orbitalPeriodDays: 10759.22,
  kepler: HELIO.Saturn,
});
export const uranus = new Planet({
  name: 'Uranus',
  description: 'The ice giant tilted on its side',
  color: 0x4fd0e7,
  radiusKm: 25362,
  orbitalPeriodDays: 30685.4,
  kepler: HELIO.Uranus,
});
export const neptune = new Planet({
  name: 'Neptune',
  description: 'The windiest planet in our solar system',
  color: 0x4b70dd,
  radiusKm: 24622,
  orbitalPeriodDays: 60190,
  kepler: HELIO.Neptune,
});
export const pluto = new Planet({
  name: 'Pluto',
  description: 'The dwarf planet at the edge of our solar system',
  color: 0xa0522d,
  radiusKm: 1188.3,
  orbitalPeriodDays: 90560,
  kepler: HELIO.Pluto,
  minLevel: 5,
});
export const phobos = new Moon({
  name: 'Phobos',
  description: 'A moon of Mars',
  color: 0xc0c0c0,
  radiusKm: 11.267,
  orbitalPeriodDays: 0.3189,
  orbits: 'Mars',
  orbitOffsetMultiplier: 100,
  satellite: {
    semiMajorAxisKm: 9376, // from Mars center
    e: 0.0151,
    i: 1.075, // approx relative to ecliptic (simplified)
    longNode: 0,
    argPeri: 0,
    meanAnomalyAtEpoch: 0,
    meanMotionDegPerDay: 360 / 0.31891,
  },
  minLevel: 1,
});
export const deimos = new Moon({
  name: 'Deimos',
  description: 'Another moon of Mars',
  color: 0xc0c0c0,
  radiusKm: 6.2,
  orbitalPeriodDays: 1.263,
  orbits: 'Mars',
  orbitOffsetMultiplier: 100,
  satellite: {
    semiMajorAxisKm: 23463,
    e: 0.00033,
    i: 1.79, // approx
    longNode: 0,
    argPeri: 0,
    meanAnomalyAtEpoch: 0,
    meanMotionDegPerDay: 360 / 1.26244,
  },
  minLevel: 1,
});

// Jupiter moons (Galilean)
export const io = new Moon({
  name: 'Io',
  description: 'Volcanic moon of Jupiter',
  color: 0xc0c0c0,
  radiusKm: 1821.6,
  orbitalPeriodDays: 1.769,
  orbits: 'Jupiter',

  satellite: {
    semiMajorAxisKm: 421700,
    e: 0.0041,
    i: 0.04,
    longNode: 0,
    argPeri: 0,
    meanAnomalyAtEpoch: 0,
    meanMotionDegPerDay: 360 / 1.769,
  },
  minLevel: 2,
});
export const europa = new Moon({
  name: 'Europa',
  description: 'Icy moon with subsurface ocean',
  color: 0xc0c0c0,
  radiusKm: 1560.8,
  orbitalPeriodDays: 3.551,
  orbits: 'Jupiter',

  satellite: {
    semiMajorAxisKm: 671100,
    e: 0.009,
    i: 0.47,
    longNode: 0,
    argPeri: 0,
    meanAnomalyAtEpoch: 0,
    meanMotionDegPerDay: 360 / 3.551,
  },
  minLevel: 1,
});
export const ganymede = new Moon({
  name: 'Ganymede',
  description: 'Largest moon in the Solar System',
  color: 0xc0c0c0,
  radiusKm: 2634.1,
  orbitalPeriodDays: 7.155,
  orbits: 'Jupiter',

  satellite: {
    semiMajorAxisKm: 1070400,
    e: 0.0013,
    i: 0.2,
    longNode: 0,
    argPeri: 0,
    meanAnomalyAtEpoch: 0,
    meanMotionDegPerDay: 360 / 7.155,
  },
  minLevel: 3,
});
export const callisto = new Moon({
  name: 'Callisto',
  description: 'Heavily cratered outer Galilean moon',
  color: 0xc0c0c0,
  radiusKm: 2410.3,
  orbitalPeriodDays: 16.689,
  orbits: 'Jupiter',

  satellite: {
    semiMajorAxisKm: 1882700,
    e: 0.007,
    i: 0.19,
    longNode: 0,
    argPeri: 0,
    meanAnomalyAtEpoch: 0,
    meanMotionDegPerDay: 360 / 16.689,
  },
  minLevel: 3,
});

// Saturn moons
export const titan = new Moon({
  name: 'Titan',
  description: 'Largest moon of Saturn with thick atmosphere',
  color: 0xc0c0c0,
  radiusKm: 2574.7,
  orbitalPeriodDays: 15.945,
  orbits: 'Saturn',
  satellite: {
    semiMajorAxisKm: 1221870,
    e: 0.0288,
    i: 0.348,
    longNode: 0,
    argPeri: 0,
    meanAnomalyAtEpoch: 0,
    meanMotionDegPerDay: 360 / 15.945,
  },
  minLevel: 1,
});
export const iapetus = new Moon({
  name: 'Iapetus',
  description: 'Distant moon of Saturn with a two-tone surface',
  color: 0xc0c0c0,
  radiusKm: 734.5,
  orbitalPeriodDays: 79.3215,
  orbits: 'Saturn',
  satellite: {
    semiMajorAxisKm: 3560820,
    e: 0.0286,
    i: 7.5,
    longNode: 0,
    argPeri: 0,
    meanAnomalyAtEpoch: 0,
    meanMotionDegPerDay: 360 / 79.3215,
  },
  minLevel: 4,
});

// Neptune moon
export const triton = new Moon({
  name: 'Triton',
  description: 'Retrograde moon of Neptune',
  color: 0xc0c0c0,
  radiusKm: 1353.4,
  orbitalPeriodDays: 5.8769,
  orbits: 'Neptune',

  satellite: {
    semiMajorAxisKm: 354759,
    e: 0.00002,
    i: 156.8, // retrograde inclination
    longNode: 0,
    argPeri: 0,
    meanAnomalyAtEpoch: 0,
    meanMotionDegPerDay: -360 / 5.8769, // retrograde
  },
  minLevel: 1,
});

export const cBodies: CBody[] = [
  sun,
  earth,
  moon,
  mercury,
  venus,
  mars,
  jupiter,
  saturn,
  uranus,
  neptune,
  pluto,
  // Martian moons
  phobos,
  deimos,
  // Jovian moons
  io,
  europa,
  ganymede,
  callisto,
  // Saturn moons
  titan,
  iapetus,
  // Neptune moon
  triton,
];
