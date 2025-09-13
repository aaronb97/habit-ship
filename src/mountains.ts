import { Meter } from './utils/units';

export type Mountain = {
  name: string;
  height: Meter;
  description: string;
  location: string;
  minLevel: number;
};

export const mountains: Mountain[] = [
  // Level 1: Beginner Peaks - Focus on trail hiking and basic preparedness.
  {
    name: 'Ben Nevis',
    height: 1345 as Meter,
    description:
      'The highest mountain in the British Isles. While its elevation is modest, the weather can be treacherous, offering a great introduction to mountain safety and navigation.',
    location: 'United Kingdom',
    minLevel: 1,
  },
  {
    name: 'Mount Washington',
    height: 1917 as Meter,
    description:
      "Located in New Hampshire, it's notorious for its dangerously erratic weather and holds the record for the highest wind gust directly observed on the Earth's surface. A true test of preparedness.",
    location: 'United States',
    minLevel: 1,
  },
  {
    name: 'Mount Kosciuszko',
    height: 2228 as Meter,
    description:
      "Australia's highest peak, located in the Snowy Mountains. It's considered one of the easiest of the Seven Summits, accessible via a well-maintained walking track.",
    location: 'Australia',
    minLevel: 1,
  },

  // Level 2: Introduction to Altitude - Higher elevations requiring good fitness.
  {
    name: 'Mount Fuji',
    height: 3776 as Meter,
    description:
      "Japan's iconic and sacred volcano. A popular pilgrimage site, its symmetrical cone is a symbol of the country. Climbing during the summer offers a manageable introduction to high-altitude trekking.",
    location: 'Japan',
    minLevel: 2,
  },
  {
    name: 'Mount Toubkal',
    height: 4167 as Meter,
    description:
      "The highest peak in North Africa's Atlas Mountains. It's a popular trekking destination offering stunning views of the surrounding landscape, accessible from Marrakech.",
    location: 'Morocco',
    minLevel: 2,
  },
  {
    name: 'Mount Whitney',
    height: 4421 as Meter,
    description:
      'The tallest mountain in the contiguous United States. Its popular trail provides a non-technical but physically demanding high-altitude experience in the beautiful Sierra Nevada.',
    location: 'United States',
    minLevel: 2,
  },

  // Level 3: Basic Mountaineering - May require crampons, ice axes, and glacier travel skills.
  {
    name: 'Mount Rainier',
    height: 4392 as Meter,
    description:
      'An active stratovolcano and the most glaciated peak in the contiguous U.S. It serves as a primary training ground for high-altitude mountaineers preparing for major expeditions.',
    location: 'United States',
    minLevel: 3,
  },
  {
    name: 'Mount Wilhelm',
    height: 4509 as Meter,
    description:
      "Oceania's highest volcanic peak, offering a challenging tropical climb through diverse rainforests to a rugged, often-icy summit.",
    location: 'Papua New Guinea',
    minLevel: 3,
  },
  {
    name: 'Mont Blanc',
    height: 4809 as Meter,
    description:
      'The highest mountain in the Alps and Western Europe. Considered the birthplace of modern mountaineering, it offers numerous routes demanding glacier travel and rock scrambling skills.',
    location: 'France/Italy',
    minLevel: 3,
  },

  // Level 4: Technical & Remote - Involves significant technical skill or logistical challenges.
  {
    name: 'Puncak Jaya (Carstensz Pyramid)',
    height: 4884 as Meter,
    description:
      'The highest peak of Oceania. It is the most technically demanding of the Seven Summits, requiring solid rock climbing skills to navigate the sharp, limestone arête to the summit.',
    location: 'Indonesia',
    minLevel: 4,
  },
  {
    name: 'Mount Elbrus',
    height: 5642 as Meter,
    description:
      "A dormant volcano in the Caucasus Mountains. As Europe's highest peak, its twin summits are a coveted prize, but climbers must be prepared for high altitude and extreme, unpredictable weather.",
    location: 'Russia',
    minLevel: 4,
  },
  {
    name: 'Mount Logan',
    height: 5959 as Meter,
    description:
      "Canada's highest mountain and the second-highest peak in North America. Known for its immense bulk and brutally cold temperatures, it presents a serious expeditionary challenge.",
    location: 'Canada',
    minLevel: 4,
  },

  // Level 5: High Altitude Expedition - Serious peaks requiring acclimatization and endurance.
  {
    name: 'Kilimanjaro',
    height: 5895 as Meter,
    description:
      "Africa's highest peak and the world's tallest free-standing mountain. It's a non-technical trek, but the high altitude makes it a significant physical and mental challenge.",
    location: 'Tanzania',
    minLevel: 5,
  },
  {
    name: 'Mount Vinson',
    height: 4892 as Meter,
    description:
      "The highest peak in Antarctica. Its challenge comes not from technical difficulty but from the extreme cold, isolation, and logistical hurdles of reaching the planet's most remote continent.",
    location: 'Antarctica',
    minLevel: 5,
  },
  {
    name: 'Denali',
    height: 6190 as Meter,
    description:
      "North America's highest peak, renowned for its extreme weather and significant vertical relief. It offers one of the world's most formidable mountaineering challenges outside of the Himalayas.",
    location: 'United States',
    minLevel: 7,
  },

  // Level 6+: Extreme Altitude / The 'Death Zone' - The world's greatest climbing challenges.
  {
    name: 'Aconcagua',
    height: 6960 as Meter,
    description:
      "The highest mountain outside of Asia, dominating the Andes. While considered a non-technical 'trekking peak' via the normal route, its extreme altitude and harsh winds demand respect.",
    location: 'Argentina',
    minLevel: 8,
  },
  {
    name: 'Manaslu',
    height: 8163 as Meter,
    description:
      "Known as the 'Mountain of the Spirit,' it's the eighth-highest mountain in the world. It is considered a more accessible eight-thousander, often used as a preparatory climb for Everest.",
    location: 'Nepal',
    minLevel: 10,
  },
  {
    name: 'Lhotse',
    height: 8516 as Meter,
    description:
      "The fourth highest mountain on Earth, intimately linked to Everest as it's part of the same massif. Its south face is one of the most impressively steep and difficult walls in the world.",
    location: 'Nepal/China',
    minLevel: 13,
  },
  {
    name: 'K2',
    height: 8611 as Meter,
    description:
      "The 'Savage Mountain,' the world's second-highest peak. It is notorious for its extreme difficulty, steepness, and unpredictable weather, with one of the highest fatality rates among the eight-thousanders.",
    location: 'Pakistan/China',
    minLevel: 15,
  },
  {
    name: 'Mount Everest',
    height: 8848 as Meter,
    description:
      'The highest point on Earth. Climbing Everest is a life-long dream for many, representing the ultimate mountaineering achievement, pushing the limits of human endurance at the edge of the atmosphere.',
    location: 'Nepal/China',
    minLevel: 20,
  },
];
