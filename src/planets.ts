import { DailyPosition } from './types';

export type Planet = {
  name: string;
  description: string;
  minLevel: number;
  dailyPositions: DailyPosition[];
};

// Get dates for the next 7 days starting from today
const today = new Date();
const dates: string[] = [];
for (let i = 0; i < 7; i++) {
  const date = new Date(today);
  date.setDate(today.getDate() + i);
  dates.push(date.toISOString().split('T')[0]);
}

export const planets: Planet[] = [
  {
    name: 'Earth',
    description: 'Home sweet home',
    minLevel: 1,
    dailyPositions: [
      { date: dates[0], coordinates: { x: 0, y: 0, z: 0 } },
      { date: dates[1], coordinates: { x: 0, y: 0, z: 0 } },
      { date: dates[2], coordinates: { x: 0, y: 0, z: 0 } },
      { date: dates[3], coordinates: { x: 0, y: 0, z: 0 } },
      { date: dates[4], coordinates: { x: 0, y: 0, z: 0 } },
      { date: dates[5], coordinates: { x: 0, y: 0, z: 0 } },
      { date: dates[6], coordinates: { x: 0, y: 0, z: 0 } },
    ],
  },
  {
    name: 'The Moon',
    description: 'Our celestial companion',
    minLevel: 1,
    dailyPositions: [
      { date: dates[0], coordinates: { x: 384400, y: 0, z: 0 } },
      { date: dates[1], coordinates: { x: 370000, y: 100000, z: 5000 } },
      { date: dates[2], coordinates: { x: 340000, y: 180000, z: 8000 } },
      { date: dates[3], coordinates: { x: 290000, y: 240000, z: 10000 } },
      { date: dates[4], coordinates: { x: 220000, y: 280000, z: 9000 } },
      { date: dates[5], coordinates: { x: 140000, y: 300000, z: 6000 } },
      { date: dates[6], coordinates: { x: 50000, y: 310000, z: 2000 } },
    ],
  },
  {
    name: 'Mercury',
    description: 'Closest planet to the Sun',
    minLevel: 2,
    dailyPositions: [
      { date: dates[0], coordinates: { x: 57910000, y: 0, z: 0 } },
      { date: dates[1], coordinates: { x: 57800000, y: 5000000, z: 100000 } },
      { date: dates[2], coordinates: { x: 57500000, y: 10000000, z: 200000 } },
      { date: dates[3], coordinates: { x: 57000000, y: 14500000, z: 280000 } },
      { date: dates[4], coordinates: { x: 56300000, y: 18500000, z: 340000 } },
      { date: dates[5], coordinates: { x: 55400000, y: 22000000, z: 380000 } },
      { date: dates[6], coordinates: { x: 54300000, y: 25000000, z: 400000 } },
    ],
  },
  {
    name: 'Venus',
    description: 'The morning star',
    minLevel: 3,
    dailyPositions: [
      { date: dates[0], coordinates: { x: 108200000, y: 0, z: 0 } },
      { date: dates[1], coordinates: { x: 108000000, y: 3000000, z: 50000 } },
      { date: dates[2], coordinates: { x: 107600000, y: 6000000, z: 100000 } },
      { date: dates[3], coordinates: { x: 107000000, y: 8900000, z: 145000 } },
      { date: dates[4], coordinates: { x: 106200000, y: 11700000, z: 185000 } },
      { date: dates[5], coordinates: { x: 105200000, y: 14400000, z: 220000 } },
      { date: dates[6], coordinates: { x: 104000000, y: 17000000, z: 250000 } },
    ],
  },
  {
    name: 'Mars',
    description: 'The Red Planet',
    minLevel: 4,
    dailyPositions: [
      { date: dates[0], coordinates: { x: 227900000, y: 0, z: 0 } },
      { date: dates[1], coordinates: { x: 227800000, y: 2000000, z: 30000 } },
      { date: dates[2], coordinates: { x: 227500000, y: 4000000, z: 60000 } },
      { date: dates[3], coordinates: { x: 227000000, y: 5900000, z: 88000 } },
      { date: dates[4], coordinates: { x: 226300000, y: 7800000, z: 114000 } },
      { date: dates[5], coordinates: { x: 225400000, y: 9600000, z: 138000 } },
      { date: dates[6], coordinates: { x: 224300000, y: 11300000, z: 160000 } },
    ],
  },
];
