import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export type TiltShiftParams = {
  enabled: boolean;
  focus: number; // normalized [0..1] vertical position of focus band center
  range: number; // normalized half-width of fully sharp region around focus
  feather: number; // normalized falloff added outside range where blur grows in
  blur: number; // base blur radius in pixels (applied where factor=1)
};

function makeShader(direction: THREE.Vector2) {
  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;     // render target resolution in pixels
    uniform float focus;         // [0,1] vertical center of focus band
    uniform float range;         // [0,1] half-width of sharp band
    uniform float feather;       // [0,1] additional soft falloff
    uniform float blur;          // base blur radius in pixels
    uniform vec2 dir;            // blur direction (1,0)=horizontal, (0,1)=vertical

    varying vec2 vUv;

    // 9-tap Gaussian weights (normalized)
    const float w0 = 0.2270270270;
    const float w1 = 0.1945945946;
    const float w2 = 0.1216216216;
    const float w3 = 0.0540540541;
    const float w4 = 0.0162162162;

    vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
    vec3 toSRGB(vec3 c) { return pow(c, vec3(1.0/2.2)); }

    vec3 blurSampleLinear(vec2 uv, float radiusPx) {
      // Convert pixel radius to UV step in the given direction
      vec2 stepUV = radiusPx * dir / resolution;
      // Accumulate in linear space; kernel weights sum to ~1.0
      vec3 acc = toLinear(texture2D(tDiffuse, uv).rgb) * w0;
      acc += toLinear(texture2D(tDiffuse, uv + stepUV * 1.3846153846).rgb) * w1;
      acc += toLinear(texture2D(tDiffuse, uv - stepUV * 1.3846153846).rgb) * w1;
      acc += toLinear(texture2D(tDiffuse, uv + stepUV * 3.2307692308).rgb) * w2;
      acc += toLinear(texture2D(tDiffuse, uv - stepUV * 3.2307692308).rgb) * w2;
      // Extra taps for smoother look at larger radii
      acc += toLinear(texture2D(tDiffuse, uv + stepUV * 5.0).rgb) * w3;
      acc += toLinear(texture2D(tDiffuse, uv - stepUV * 5.0).rgb) * w3;
      acc += toLinear(texture2D(tDiffuse, uv + stepUV * 7.0).rgb) * w4;
      acc += toLinear(texture2D(tDiffuse, uv - stepUV * 7.0).rgb) * w4;
      return acc;
    }

    void main() {
      // Distance from the focus band center along vertical screen axis
      float d = abs(vUv.y - focus);
      // 0 inside sharp band, 1 fully blurred beyond range+feather
      float factor = smoothstep(range, range + feather, d);
      float radiusPx = blur * factor;
      vec4 src = texture2D(tDiffuse, vUv);
      // Compute blurred color in linear space
      vec3 blurLin = blurSampleLinear(vUv, radiusPx);
      // Blend in linear space to preserve perceived brightness
      vec3 srcLin = toLinear(src.rgb);
      vec3 outLin = mix(srcLin, blurLin, factor);
      vec3 outSRGB = toSRGB(outLin);
      gl_FragColor = vec4(outSRGB, src.a);
    }
  `;

  const uniforms = {
    tDiffuse: { value: null as unknown as THREE.Texture },
    resolution: { value: new THREE.Vector2(1, 1) },
    focus: { value: 0.5 },
    range: { value: 0.25 },
    feather: { value: 0.2 },
    blur: { value: 6.0 },
    dir: { value: direction.clone() },
  } satisfies Record<string, { value: unknown }>;

  return { vertexShader, fragmentShader, uniforms };
}

export function createTiltShiftPasses(
  size: THREE.Vector2,
  params: TiltShiftParams,
): {
  horizontal: ShaderPass;
  vertical: ShaderPass;
  update: (p: Partial<TiltShiftParams>) => void;
  setSize: (v: THREE.Vector2) => void;
} {
  const shaderH = makeShader(new THREE.Vector2(1, 0));
  const shaderV = makeShader(new THREE.Vector2(0, 1));

  const passH = new ShaderPass(shaderH);
  const passV = new ShaderPass(shaderV);

  const apply = (p: Partial<TiltShiftParams>) => {
    const next = {
      enabled: params.enabled,
      focus: params.focus,
      range: params.range,
      feather: params.feather,
      blur: params.blur,
      ...p,
    };

    params = next;
    passH.enabled = next.enabled;
    passV.enabled = next.enabled;

    (
      passH as unknown as { uniforms: typeof shaderH.uniforms }
    ).uniforms.focus.value = next.focus;

    (
      passV as unknown as { uniforms: typeof shaderV.uniforms }
    ).uniforms.focus.value = next.focus;

    (
      passH as unknown as { uniforms: typeof shaderH.uniforms }
    ).uniforms.range.value = next.range;

    (
      passV as unknown as { uniforms: typeof shaderV.uniforms }
    ).uniforms.range.value = next.range;

    (
      passH as unknown as { uniforms: typeof shaderH.uniforms }
    ).uniforms.feather.value = next.feather;

    (
      passV as unknown as { uniforms: typeof shaderV.uniforms }
    ).uniforms.feather.value = next.feather;

    (
      passH as unknown as { uniforms: typeof shaderH.uniforms }
    ).uniforms.blur.value = next.blur;

    (
      passV as unknown as { uniforms: typeof shaderV.uniforms }
    ).uniforms.blur.value = next.blur;
  };

  const setSize = (v: THREE.Vector2) => {
    (
      passH as unknown as { uniforms: typeof shaderH.uniforms }
    ).uniforms.resolution.value.copy(v);

    (
      passV as unknown as { uniforms: typeof shaderV.uniforms }
    ).uniforms.resolution.value.copy(v);
  };

  setSize(size);
  apply(params);

  return {
    horizontal: passH,
    vertical: passV,
    update: apply,
    setSize,
  };
}
