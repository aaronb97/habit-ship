import { Meter } from './utils/units';

export type Mountain = {
  name: string;
  height: Meter;
  description: string;
  location: string;
};

export const mountains: Mountain[] = [
  {
    name: 'Mount Kosciuszko',
    height: 2228 as Meter,
    description: 'The highest mountain in Australia.',
    location: 'Australia',
  },
  {
    name: 'Mount Elbrus',
    height: 5642 as Meter,
    description: 'The highest mountain in Europe.',
    location: 'Russia',
  },
  {
    name: 'Mount Vinson',
    height: 4892 as Meter,
    description: 'The highest peak in Antarctica.',
    location: 'Antarctica',
  },
  {
    name: 'Puncak Jaya',
    height: 4884 as Meter,
    description: 'The highest mountain in Oceania.',
    location: 'Indonesia',
  },
  {
    name: 'Mount Wilhelm',
    height: 4509 as Meter,
    description: 'The highest mountain in Papua New Guinea.',
    location: 'Papua New Guinea',
  },
  {
    name: 'Denali',
    height: 6190 as Meter,
    description: 'The highest mountain peak in North America.',
    location: 'United States',
  },
  {
    name: 'Aconcagua',
    height: 6960 as Meter,
    description: 'The highest mountain outside of Asia.',
    location: 'Argentina',
  },
  {
    name: 'Kilimanjaro',
    height: 5895 as Meter,
    description: 'The highest mountain in Africa.',
    location: 'Tanzania',
  },
  {
    name: 'K2',
    height: 8611 as Meter,
    description: 'The second-highest mountain in the world.',
    location: 'Pakistan/China',
  },
  {
    name: 'Mount Everest',
    height: 8848 as Meter,
    description: 'The highest mountain in the world.',
    location: 'Nepal/China',
  },
];
