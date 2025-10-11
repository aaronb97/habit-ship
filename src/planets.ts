import earthPositions from './positions/earth.json';
import moonPositions from './positions/moon.json';
import mercuryPositions from './positions/mercury.json';
import venusPositions from './positions/venus.json';
import marsPositions from './positions/mars.json';
import { getCurrentDate } from './utils/time';

export class Planet {
  public name: string;
  public description: string;
  public minLevel: number;
  public dailyPositions: Record<string, [number, number, number]>;

  constructor(options: {
    name: string;
    description: string;
    minLevel: number;
    dailyPositions: Record<string, number[]>;
  }) {
    this.name = options.name;
    this.description = options.description;
    this.minLevel = options.minLevel;
    this.dailyPositions = options.dailyPositions as Record<
      string,
      [number, number, number]
    >;
  }

  getCurrentPosition() {
    const today = getCurrentDate().toISOString().split('T')[0]!;
    let coords = this.dailyPositions[today];

    if (!coords) {
      const values = Object.values(this.dailyPositions);
      coords = values[values.length - 1];
    }

    const [x = 0, y = 0, z = 0] = coords || [];
    return { x, y, z };
  }
}

export const earth = new Planet({
  name: 'Earth',
  description: 'Home sweet home',
  minLevel: 1,
  dailyPositions: earthPositions,
});
export const moon = new Planet({
  name: 'The Moon',
  description: 'Our celestial companion',
  minLevel: 1,
  dailyPositions: moonPositions,
});
export const mercury = new Planet({
  name: 'Mercury',
  description: 'Closest planet to the Sun',
  minLevel: 1,
  dailyPositions: mercuryPositions,
});
export const venus = new Planet({
  name: 'Venus',
  description: 'The morning star',
  minLevel: 1,
  dailyPositions: venusPositions,
});
export const mars = new Planet({
  name: 'Mars',
  description: 'The Red Planet',
  minLevel: 1,
  dailyPositions: marsPositions,
});

export const planets: Planet[] = [earth, moon, mercury, venus, mars];
