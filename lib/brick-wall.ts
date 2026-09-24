// The small brick wall engraved on every Builder card. Bricks are laid bottom row
// first, left to right; the Builder's own bricks are filled in. Alternate rows are
// offset by half a brick, so their end bricks are cut by the edge like a real wall.
// Keep in step with wallSvg() in public/js/main.js.
export const WALL = { w: 20, h: 9, gap: 2, cols: 6, rows: 5, width: 130, height: 53 };

export type Brick = { x: number; y: number; i: number; laid: boolean; last: boolean };

export function brickWall(laid: number): Brick[] {
  const { w, h, gap, cols, rows } = WALL;
  const out: Brick[] = [];
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const y = (rows - 1 - r) * (h + gap);
    const offset = r % 2 ? -(w + gap) / 2 : 0;
    const n = r % 2 ? cols + 1 : cols;
    for (let c = 0; c < n; c++, i++) {
      out.push({ x: offset + c * (w + gap), y, i, laid: i < laid, last: false });
    }
  }
  const last = Math.min(laid, out.length) - 1;
  out.forEach(b => { b.last = b.i === last; });
  return out;
}
