import earthPositions from './positions/earth.json';
import moonPositions from './positions/moon.json';
import mercuryPositions from './positions/mercury.json';
import venusPositions from './positions/venus.json';
import marsPositions from './positions/mars.json';
import jupiterPositions from './positions/jupiter.json';
import saturnPositions from './positions/saturn.json';
import uranusPositions from './positions/uranus.json';
import neptunePositions from './positions/neptune.json';
import plutoPositions from './positions/pluto.json';
import { getCurrentDate } from './utils/time';

/**
 * Short for celestial body
 */
export interface CBody {
  name: string;
  description: string;
  color: number;
  radiusKm: number;

  getCurrentPosition(): [number, number, number];
}

interface BaseCBodyOptions {
  name: string;
  description: string;
  radiusKm: number;
}

interface PlanetOptions extends BaseCBodyOptions {
  dailyPositions: Record<string, number[]>;
  color: number;
}

interface LandablePlanetOptions extends PlanetOptions {
  minLevel: number;
}

interface StarOptions extends BaseCBodyOptions {
  color?: number;
  position: [number, number, number];
}

export class Planet implements CBody {
  public name: string;
  public description: string;
  public dailyPositions: Record<string, [number, number, number]>;
  public color: number;
  public radiusKm: number;

  constructor(options: PlanetOptions) {
    this.name = options.name;
    this.description = options.description;
    this.color = options.color;
    this.radiusKm = options.radiusKm;
    this.dailyPositions = options.dailyPositions as Record<
      string,
      [number, number, number]
    >;
  }

  getCurrentPosition() {
    const today = getCurrentDate().toISOString().split('T')[0]!;
    const coords = this.dailyPositions[today];

    if (!coords) {
      const values = Object.values(this.dailyPositions);
      return values[values.length - 1]!;
    }

    return coords;
  }
}

export class LandablePlanet extends Planet {
  public minLevel: number;

  constructor(options: LandablePlanetOptions) {
    super(options);
    this.minLevel = options.minLevel;
  }
}

export class UnlandablePlanet extends Planet {
  constructor(options: PlanetOptions) {
    super(options);
  }
}

export class Star implements CBody {
  public name: string;
  public description: string;
  private position: [number, number, number];
  public color: number;
  public radiusKm: number;

  constructor(options: StarOptions) {
    this.name = options.name;
    this.description = options.description;
    this.color = options.color ?? 0xfff700;
    this.position = options.position;
    this.radiusKm = options.radiusKm;
  }

  getCurrentPosition() {
    return this.position;
  }
}

export const sun = new Star({
  name: 'Sun',
  description: 'The star at the center of our solar system',
  position: [0, 0, 0],
  radiusKm: 696340,
});
export const earth = new LandablePlanet({
  name: 'Earth',
  description: 'Home sweet home',
  minLevel: 1,
  color: 0x6b93d6,
  dailyPositions: earthPositions,
  radiusKm: 6371,
});
export const moon = new LandablePlanet({
  name: 'The Moon',
  description: 'Our celestial companion',
  minLevel: 1,
  color: 0xc0c0c0,
  dailyPositions: moonPositions,
  radiusKm: 1737.4,
});
export const mercury = new LandablePlanet({
  name: 'Mercury',
  description: 'Closest planet to the Sun',
  minLevel: 1,
  color: 0x8c7853,
  dailyPositions: mercuryPositions,
  radiusKm: 2439.7,
});
export const venus = new LandablePlanet({
  name: 'Venus',
  description: 'The morning star',
  minLevel: 1,
  color: 0xffc649,
  dailyPositions: venusPositions,
  radiusKm: 6051.8,
});
export const mars = new LandablePlanet({
  name: 'Mars',
  description: 'The Red Planet',
  minLevel: 1,
  color: 0xcd5c5c,
  dailyPositions: marsPositions,
  radiusKm: 3389.5,
});
export const jupiter = new UnlandablePlanet({
  name: 'Jupiter',
  description: 'The largest planet in our solar system',
  color: 0xd8ca9d,
  dailyPositions: jupiterPositions,
  radiusKm: 69911,
});
export const saturn = new UnlandablePlanet({
  name: 'Saturn',
  description: 'The ringed planet',
  color: 0xfad5a5,
  dailyPositions: saturnPositions,
  radiusKm: 58232,
});
export const uranus = new UnlandablePlanet({
  name: 'Uranus',
  description: 'The ice giant tilted on its side',
  color: 0x4fd0e7,
  dailyPositions: uranusPositions,
  radiusKm: 25362,
});
export const neptune = new UnlandablePlanet({
  name: 'Neptune',
  description: 'The windiest planet in our solar system',
  color: 0x4b70dd,
  dailyPositions: neptunePositions,
  radiusKm: 24622,
});
export const pluto = new LandablePlanet({
  name: 'Pluto',
  description: 'The dwarf planet at the edge of our solar system',
  minLevel: 5,
  color: 0xa0522d,
  dailyPositions: plutoPositions,
  radiusKm: 1188.3,
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
];
