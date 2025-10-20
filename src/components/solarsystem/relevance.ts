import { Planet, Moon, type CBody } from '../../planets';

/**
 * Compute which planet systems are relevant for rendering moons, based on the
 * current starting location and target body names.
 * - If the name refers to a Moon, include its parent planet's system (moon.orbits)
 * - If the name refers to a Planet, include the planet's name
 */
export function getRelevantPlanetSystemsFor(
  starting?: string,
  targetName?: string,
  bodies: CBody[] = [],
): Set<string> {
  const systems = new Set<string>();

  const addSystemForName = (name: string | undefined) => {
    if (!name) {
      return;
    }

    const body = bodies.find((b) => b.name === name);
    if (!body) {
      return;
    }

    if (body instanceof Moon) {
      systems.add(body.orbits);
    } else if (body instanceof Planet) {
      systems.add(body.name);
    }
  };

  addSystemForName(starting);
  addSystemForName(targetName);

  return systems;
}
