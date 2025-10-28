/**
 * Creates a hex color string from a 24-bit integer color.
 *
 * color: 24-bit integer color (e.g., 0xff00aa)
 * Returns: CSS hex string in the form '#rrggbb'.
 */
export function intColorToHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/**
 * Lightens a hex color by blending it toward white.
 *
 * hex: Color string in the form '#rrggbb'.
 * amount: Blend factor [0..1], where 0 is original and 1 is white.
 * Returns: Lightened CSS hex string '#rrggbb'.
 */
export function lightenHex(hex: string | number, amount = 0.55): string {
  if (typeof hex === 'number') {
    hex = intColorToHex(hex);
  }

  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const lr = clamp(r + (255 - r) * amount);
  const lg = clamp(g + (255 - g) * amount);
  const lb = clamp(b + (255 - b) * amount);

  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(lr)}${toHex(lg)}${toHex(lb)}`;
}
