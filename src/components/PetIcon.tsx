import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useStore } from '../utils/store';

export function PetIcon() {
  const { pets } = useStore();
  const pet = pets[0];

  if (!pet) return null;

  if (pet.type === 'Penguin' || pet.type === 'Puffin') {
    return (
      <MaterialCommunityIcons
        name="penguin"
        size={20}
        color="white"
      />
    );
  }

  if (pet.type === 'Turtle') {
    return (
      <MaterialCommunityIcons
        name="turtle"
        size={20}
        color="white"
      />
    );
  }

  if (pet.type === 'Gecko') {
    return (
      <MaterialCommunityIcons
        name="snake"
        size={20}
        color="white"
      />
    );
  }

  if (pet.type === 'Panda') {
    return (
      <MaterialCommunityIcons
        name="panda"
        size={20}
        color="white"
      />
    );
  }
}
