import { describe, expect, it } from "vitest";
import { AVATAR_VIEWPORT, getAvatarGeometry } from "./avatar";

describe("avatar crop geometry", () => {
  it("centres the largest square in a landscape or portrait photo", () => {
    expect(getAvatarGeometry(1200, 800).crop).toEqual({
      x: 200,
      y: 0,
      size: 800,
    });
    expect(getAvatarGeometry(800, 1200).crop).toEqual({
      x: 0,
      y: 200,
      size: 800,
    });
  });

  it("allows a portrait photo to be moved to its first or last pixel without blank edges", () => {
    const top = getAvatarGeometry(800, 1200, 1, { x: 1000, y: 1000 });
    const bottom = getAvatarGeometry(800, 1200, 1, { x: -1000, y: -1000 });
    expect(top.crop).toEqual({ x: 0, y: 0, size: 800 });
    expect(bottom.crop).toEqual({ x: 0, y: 400, size: 800 });
    expect(top.offset.x).toBe(0);
  });

  it("exports the exact source square visible after zooming and dragging", () => {
    const result = getAvatarGeometry(1200, 800, 2, { x: 26, y: -52 });
    expect(result.crop).toEqual({ x: 360, y: 280, size: 400 });
    const scale = result.renderedWidth / 1200;
    const imageLeft =
      (AVATAR_VIEWPORT - result.renderedWidth) / 2 + result.offset.x;
    const imageTop =
      (AVATAR_VIEWPORT - result.renderedHeight) / 2 + result.offset.y;
    expect(result.crop.x * scale + imageLeft).toBeCloseTo(0);
    expect(result.crop.y * scale + imageTop).toBeCloseTo(0);
    expect(result.crop.size * scale).toBeCloseTo(AVATAR_VIEWPORT);
  });

  it.each([
    [301, 511],
    [2000, 400],
    [1, 1],
    [801, 1203],
  ])(
    "keeps the crop inside a %s × %s image at all zooms and extreme offsets",
    (width, height) => {
      for (const zoom of [1, 1.01, 1.7, 4]) {
        for (const x of [-100000, 0, 100000]) {
          for (const y of [-100000, 0, 100000]) {
            const result = getAvatarGeometry(width, height, zoom, { x, y });
            expect(result.crop.x).toBeGreaterThanOrEqual(0);
            expect(result.crop.y).toBeGreaterThanOrEqual(0);
            expect(result.crop.x + result.crop.size).toBeLessThanOrEqual(
              width + 1e-8,
            );
            expect(result.crop.y + result.crop.size).toBeLessThanOrEqual(
              height + 1e-8,
            );
            expect(result.renderedWidth).toBeGreaterThanOrEqual(
              AVATAR_VIEWPORT - 1e-8,
            );
            expect(result.renderedHeight).toBeGreaterThanOrEqual(
              AVATAR_VIEWPORT - 1e-8,
            );
          }
        }
      }
    },
  );

  it("preserves the chosen source centre when the zoom and offset grow together", () => {
    const initial = getAvatarGeometry(1200, 800, 1.5, { x: 30, y: 20 });
    const zoomed = getAvatarGeometry(1200, 800, 3, { x: 60, y: 40 });
    expect(initial.crop.x + initial.crop.size / 2).toBeCloseTo(
      zoomed.crop.x + zoomed.crop.size / 2,
    );
    expect(initial.crop.y + initial.crop.size / 2).toBeCloseTo(
      zoomed.crop.y + zoomed.crop.size / 2,
    );
  });

  it("sanitizes zoom and offsets and rejects invalid source dimensions", () => {
    expect(
      getAvatarGeometry(500, 500, -1, { x: NaN, y: Infinity }).crop,
    ).toEqual({ x: 0, y: 0, size: 500 });
    expect(getAvatarGeometry(500, 500, 100).zoom).toBe(4);
    for (const size of [0, -10, NaN, Infinity]) {
      expect(() => getAvatarGeometry(size, 500)).toThrow("image");
      expect(() => getAvatarGeometry(500, size)).toThrow("image");
    }
  });
});
