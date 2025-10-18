import type { CameraController } from './camera';

let controller: CameraController | null = null;

export function registerController(c: CameraController | null) {
  controller = c;
}

export function getController(): CameraController | null {
  return controller;
}
