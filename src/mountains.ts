import { Meter } from './utils/units';

export type Mountain = {
  name: string;
  height: Meter;
  description: string;
  location: string;
  minLevel: number;
};

export const mountains: Mountain[] = [
  {
    name: 'Mount Kosciuszko',
    height: 2228 as Meter,
    description: 'The highest mountain in Australia.',
    location: 'Australia',
    minLevel: 1,
  },
  {
    name: 'Mount Elbrus',
    height: 5642 as Meter,
    description: 'The highest mountain in Europe.',
    location: 'Russia',
    minLevel: 3,
  },
  {
    name: 'Mount Vinson',
    height: 4892 as Meter,
    description: 'The highest peak in Antarctica.',
    location: 'Antarctica',
    minLevel: 5,
  },
  {
    name: 'Puncak Jaya',
    height: 4884 as Meter,
    description: 'The highest mountain in Oceania.',
    location: 'Indonesia',
    minLevel: 4,
  },
  {
    name: 'Mount Wilhelm',
    height: 4509 as Meter,
    description: 'The highest mountain in Papua New Guinea.',
    location: 'Papua New Guinea',
    minLevel: 2,
  },
  {
    name: 'Denali',
    height: 6190 as Meter,
    description: 'The highest mountain peak in North America.',
    location: 'United States',
    minLevel: 7,
  },
  {
    name: 'Aconcagua',
    height: 6960 as Meter,
    description: 'The highest mountain outside of Asia.',
    location: 'Argentina',
    minLevel: 8,
  },
  {
    name: 'Kilimanjaro',
    height: 5895 as Meter,
    description: 'The highest mountain in Africa.',
    location: 'Tanzania',
    minLevel: 6,
  },
  {
    name: 'K2',
    height: 8611 as Meter,
    description: 'The second-highest mountain in the world.',
    location: 'Pakistan/China',
    minLevel: 15,
  },
  {
    name: 'Mount Everest',
    height: 8848 as Meter,
    description: 'The highest mountain in the world.',
    location: 'Nepal/China',
    minLevel: 20,
  },
];
