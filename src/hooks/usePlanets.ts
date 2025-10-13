import { cBodies, Planet, Moon } from '../planets';
import {
  calculateDistance,
  useCurrentPosition,
  useIsTraveling,
  useStore,
} from '../utils/store';

export interface PlanetWithDistance {
  planet: Planet | Moon;
  distance: number;
  disabledReason?: string;
  isVisited: boolean;
}

export type LandablePlanetWithDistance = PlanetWithDistance & {
  planet: Planet | Moon;
};

export function usePlanets(): PlanetWithDistance[] {
  const currentPosition = useCurrentPosition();
  const isTraveling = useIsTraveling();
  const { userPosition, completedPlanets } = useStore();

  const planetsWithDistance = cBodies
    .filter((body) => body instanceof Planet || body instanceof Moon)
    .filter((planet) => {
      // Filter out current location when not traveling
      if (!isTraveling && planet.name === userPosition.currentLocation) {
        return false;
      }

      return true;
    })
    .map((planet) => {
      const planetCoords = planet.getPosition();
      const distance = calculateDistance(currentPosition, planetCoords);

      // Determine if planet should be disabled and why
      let disabledReason: string | undefined;

      if (
        planet.name === userPosition.currentLocation &&
        !userPosition.target
      ) {
        disabledReason = 'You are currently on this planet';
      } else if (planet.name === userPosition.target?.name) {
        disabledReason = 'You are traveling here';
      }

      // Check if planet has been visited
      const isVisited = completedPlanets.includes(planet.name);

      return { planet, distance, disabledReason, isVisited };
    })
    .sort((a, b) => a.distance - b.distance);

  return planetsWithDistance;
}

export function useLandablePlanets(): LandablePlanetWithDistance[] {
  const planetsWithDistance = usePlanets();

  return planetsWithDistance.filter(
    (item) =>
      (item.planet instanceof Planet && item.planet.isLandable) ||
      item.planet instanceof Moon,
  ) as LandablePlanetWithDistance[];
}
