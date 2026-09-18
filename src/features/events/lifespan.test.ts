import { describe, expect, it } from "vitest";

import { compareByLife, lifespan } from "./lifespan";
import type { Character } from "./types";

const person = (name: string, birth: number | null, death: number | null): Character => ({
  id: name,
  name,
  bio: null,
  birth: birth === null ? null : { year: birth },
  death: death === null ? null : { year: death },
  photos: [],
});

describe("dire une vie en peu de mots", () => {
  it("relie les deux dates", () => {
    expect(lifespan(person("Napoléon", 1769, 1821))).toBe("1769 – 1821");
  });

  it("se contente de celle qu'on a", () => {
    expect(lifespan(person("X", 1769, null))).toBe("né en 1769");
    expect(lifespan(person("Y", null, 1821))).toBe("† 1821");
  });

  it("ne dit rien quand on ne sait rien", () => {
    expect(lifespan(person("Z", null, null))).toBe("");
  });
});

describe("ranger des personnages", () => {
  const order = (people: Character[]) =>
    [...people].sort(compareByLife).map((one) => one.name).join(" ");

  it("va du plus ancien au plus récent", () => {
    expect(order([person("b", 1769, null), person("a", 1412, null)])).toBe("a b");
  });

  it("se rabat sur la mort quand la naissance manque", () => {
    expect(order([person("tard", null, 1900), person("tot", null, 1500)])).toBe("tot tard");
  });

  it("met les personnages sans date tout en haut", () => {
    expect(order([person("daté", 1412, null), person("sans", null, null)])).toBe("sans daté");
  });

  it("départage par le nom, pour que l'ordre ne vacille pas", () => {
    expect(order([person("b", 1500, null), person("a", 1500, null)])).toBe("a b");
    expect(order([person("b", null, null), person("a", null, null)])).toBe("a b");
  });
});
