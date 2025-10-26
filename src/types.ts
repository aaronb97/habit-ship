// Coordinate system types
export type Coordinates = [number, number, number];

export type DailyPosition = {
  date: string; // YYYY-MM-DD format
  coordinates: Coordinates;
};

export type UserPosition = {
  startingLocation: string; // Planet/moon name if landed or the starting position if traveling
  target?: string;
  launchTime?: string; // ISO timestamp
  initialDistance?: number; // Initial distance in km at launch
  distanceTraveled?: number; // Distance traveled in km since launch
  previousDistanceTraveled?: number; // Last displayed distance used for animations
};

export type UserLevel = {
  level: number;
  currentXP: number;
  totalXP: number;
};

export type XPSource = 'habit_completion' | 'planet_completion';

export type XPGain = {
  amount: number;
  source: XPSource;
  timestamp: string;
};
