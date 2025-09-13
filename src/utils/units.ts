export type Meter = number & { __unit: 'meter' };
export type Foot = number & { __unit: 'foot' };

export const metersToFeet = (meters: Meter): Foot => {
  return (meters * 3.28084) as Foot;
};

export const feetToMeters = (feet: Foot): Meter => {
  return (feet / 3.28084) as Meter;
};
