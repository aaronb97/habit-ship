import { getRandomElement } from '../getRandomElement';

const animals = ['Turtle', 'Gecko', 'Puffin', 'Penguin', 'Panda'];

export function generateAnimalType() {
  return getRandomElement(animals);
}
