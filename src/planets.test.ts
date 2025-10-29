import { describe, test, expect } from 'vitest';
import { earth, jupiter, mars, mercury, neptune, pluto, saturn, uranus, venus } from './planets';

describe('landability', () => {
  test('mercury should be landable', () => {
    expect(mercury.isLandable).toBe(true);
  });

  test('venus should be landable', () => {
    expect(venus.isLandable).toBe(true);
  });

  test('earth should be landable', () => {
    expect(earth.isLandable).toBe(true);
  });

  test('mars should be landable', () => {
    expect(mars.isLandable).toBe(true);
  });

  test('jupiter should not be landable', () => {
    expect(jupiter.isLandable).toBe(false);
  });

  test('saturn should not be landable', () => {
    expect(saturn.isLandable).toBe(false);
  });

  test('uranus should not be landable', () => {
    expect(uranus.isLandable).toBe(false);
  });

  test('neptune should not be landable', () => {
    expect(neptune.isLandable).toBe(false);
  });

  test('pluto should be landable', () => {
    expect(pluto.isLandable).toBe(true);
  });
});
