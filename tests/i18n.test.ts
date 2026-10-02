import { describe, expect, it } from "vitest";
import { ALL_STRINGS, LANGS, hasKey } from "../src/i18n";
import { TILES } from "../src/core/tiles";

describe("i18n", () => {
  it("every string has all languages", () => {
    for (const [key, entry] of Object.entries(ALL_STRINGS)) {
      for (const l of LANGS) expect(entry[l], `${key}.${l}`).toBeTruthy();
    }
  });

  it("every tile has a name", () => {
    for (const t of TILES) expect(hasKey(`tile_${t.key}`), t.key).toBe(true);
  });
});
