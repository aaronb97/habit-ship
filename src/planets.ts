import earthPositions from './positions/earth.json';
import moonPositions from './positions/moon.json';
import mercuryPositions from './positions/mercury.json';
import venusPositions from './positions/venus.json';
import marsPositions from './positions/mars.json';

export type Planet = {
  name: string;
  description: string;
  minLevel: number;
  dailyPositions: Record<string, number[]>;
};

export const planets: Planet[] = [
  {
    name: 'Earth',
    description: 'Home sweet home',
    minLevel: 1,
    dailyPositions: earthPositions,
  },
  {
    name: 'The Moon',
    description: 'Our celestial companion',
    minLevel: 1,
    dailyPositions: moonPositions,
  },
  {
    name: 'Mercury',
    description: 'Closest planet to the Sun',
    minLevel: 2,
    dailyPositions: mercuryPositions,
  },
  {
    name: 'Venus',
    description: 'The morning star',
    minLevel: 3,
    dailyPositions: venusPositions,
  },
  {
    name: 'Mars',
    description: 'The Red Planet',
    minLevel: 4,
    dailyPositions: marsPositions,
  },
];
