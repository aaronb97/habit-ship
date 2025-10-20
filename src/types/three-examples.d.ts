declare module 'three/examples/jsm/postprocessing/EffectComposer.js' {
  import { WebGLRenderer, WebGLRenderTarget } from 'three';

  export class EffectComposer {
    constructor(renderer: WebGLRenderer, renderTarget?: WebGLRenderTarget);
    addPass(pass: unknown): void;
    render(delta?: number): void;
    setSize(width: number, height: number): void;
    dispose(): void;
  }
}

declare module 'three/examples/jsm/postprocessing/RenderPass.js' {
  import { Scene, Camera } from 'three';

  export class RenderPass {
    constructor(scene: Scene, camera: Camera);
    renderToScreen: boolean;
  }
}

declare module 'three/examples/jsm/postprocessing/OutlinePass.js' {
  import { Vector2, Scene, Camera, Color, Object3D } from 'three';

  export class OutlinePass {
    constructor(
      resolution: Vector2,
      scene: Scene,
      camera: Camera,
      selectedObjects?: Object3D[],
    );
    edgeStrength: number;
    edgeGlow: number;
    edgeThickness: number;
    pulsePeriod: number;
    visibleEdgeColor: Color;
    hiddenEdgeColor: Color;
    resolution: Vector2;
    enabled: boolean;
    renderToScreen: boolean;
    dispose(): void;
  }
}

declare module 'three/examples/jsm/postprocessing/ShaderPass.js' {
  export class ShaderPass {
    constructor(shader: unknown, textureID?: string);
    renderToScreen: boolean;
    enabled: boolean;
  }
}

declare module 'three/examples/jsm/shaders/CopyShader.js' {
  export const CopyShader: unknown;
}
