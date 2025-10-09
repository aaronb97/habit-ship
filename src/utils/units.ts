export type Meter = number & { __unit: 'meter' };
export type Foot = number & { __unit: 'foot' };

export const metersToFeet = (meters: Meter): Foot => {
  return (meters * 3.28084) as Foot;
};

export const feetToMeters = (feet: Foot): Meter => {
  return (feet / 3.28084) as Meter;
};

export type Minute = number & { __unit: 'minute' };
export type Hour = number & { __unit: 'hour' };

export const minutesToHours = (minutes: Minute): Hour => {
  return (minutes / 60) as Hour;
};

export const hoursToMinutes = (hours: Hour): Minute => {
  return (hours * 60) as Minute;
};
