import { planets } from '../planets';
import {
  calculateDistance,
  getPlanetPosition,
  useCurrentPosition,
  useIsTraveling,
  useStore,
} from '../utils/store';

export interface PlanetWithDistance {
  planet: (typeof planets)[0];
  distance: number;
  disabledReason?: string;
  isVisited: boolean;
}

export function usePlanets(): PlanetWithDistance[] {
  const currentPosition = useCurrentPosition();
  const isTraveling = useIsTraveling();
  const { userPosition, completedPlanets } = useStore();

  const planetsWithDistance = planets
    .filter((planet) => {
      // Filter out current location when not traveling
      if (!isTraveling && planet.name === userPosition.currentLocation) {
        return false;
      }

      return true;
    })
    .map((planet) => {
      const planetCoords = getPlanetPosition(planet.name);
      const distance = calculateDistance(currentPosition, planetCoords);

      // Determine if planet should be disabled and why
      let disabledReason: string | undefined;

      if (
        planet.name === userPosition.currentLocation &&
        userPosition.speed === 0
      ) {
        disabledReason = 'You are currently on this planet';
      } else if (planet.name === userPosition.target?.name) {
        disabledReason = 'You are already traveling to this planet';
      }

      // Check if planet has been visited
      const isVisited = completedPlanets.includes(planet.name);

      return { planet, distance, disabledReason, isVisited };
    })
    .sort((a, b) => a.distance - b.distance);

  return planetsWithDistance;
}
