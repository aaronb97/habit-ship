// Distance units
export type Meter = number & { __unit: 'meter' };
export type Foot = number & { __unit: 'foot' };

export const metersToFeet = (meters: Meter): Foot => {
  return (meters * 3.28084) as Foot;
};

export const feetToMeters = (feet: Foot): Meter => {
  return (feet / 3.28084) as Meter;
};

// Time formatting helpers (all internal time values are in seconds)
export function formatSecondsAsMinutes(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

export function formatSecondsAsHours(seconds: number): string {
  const hours = seconds / 3600;
  if (hours < 1) {
    return formatSecondsAsMinutes(seconds);
  }

  return `${hours.toFixed(1)} hour${hours !== 1 ? 's' : ''}`;
}

export function formatSecondsAsDaysAndHours(seconds: number): string {
  const hours = seconds / 3600;
  if (hours < 1) {
    return formatSecondsAsMinutes(seconds);
  } else if (hours < 24) {
    return formatSecondsAsHours(seconds);
  } else {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return `${days} day${days !== 1 ? 's' : ''} ${remainingHours}h`;
  }
}
