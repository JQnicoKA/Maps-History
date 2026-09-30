import { describe, expect, it } from "vitest";

import { compareByLife, lifespan, placeOfPerson, standsAt } from "./lifespan";
import type { Character } from "./types";

const person = (
  name: string,
  birth: number | null,
  death: number | null,
  placed = true,
): Character => ({
  id: name,
  name,
  bio: null,
  birth: birth === null ? null : { year: birth },
  death: death === null ? null : { year: death },
  longitude: placed ? 2.35 : null,
  latitude: placed ? 48.85 : null,
  shared: true,
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

describe("qui se tient sur la carte, et quand", () => {
  const napoleon = person("Napoléon", 1769, 1821);

  it("le montre entre sa naissance et sa mort", () => {
    expect(standsAt(napoleon, 1800)).toBe(true);
  });

  it("le montre le jour de sa naissance et celui de sa mort", () => {
    expect(standsAt(napoleon, 1769)).toBe(true);
    expect(standsAt(napoleon, 1821)).toBe(true);
  });

  it("ne le montre ni avant ni après", () => {
    expect(standsAt(napoleon, 1768)).toBe(false);
    expect(standsAt(napoleon, 1822)).toBe(false);
  });

  it("laisse une mort inconnue ouvrir la suite des temps", () => {
    const vivant = person("Sans fin", 1769, null);
    expect(standsAt(vivant, 1768)).toBe(false);
    expect(standsAt(vivant, 3000)).toBe(true);
  });

  it("garde hors de la carte qui n'a pas de naissance", () => {
    expect(standsAt(person("Sans date", null, 1821), 1800)).toBe(false);
  });

  it("garde hors de la carte qui n'a pas de lieu", () => {
    expect(standsAt(person("Nulle part", 1769, 1821, false), 1800)).toBe(false);
  });

  it("compte les années avant notre ère comme des années négatives", () => {
    const cesar = person("César", -100, -44);
    expect(standsAt(cesar, -60)).toBe(true);
    expect(standsAt(cesar, -120)).toBe(false);
    expect(standsAt(cesar, 10)).toBe(false);
  });
});

describe("le lieu d'une personne", () => {
  it("rend le couple quand il est entier", () => {
    expect(placeOfPerson(person("Napoléon", 1769, 1821))).toEqual({
      longitude: 2.35,
      latitude: 48.85,
    });
  });

  it("ne rend rien quand il manque", () => {
    expect(placeOfPerson(person("Nulle part", 1769, 1821, false))).toBeNull();
  });
});
