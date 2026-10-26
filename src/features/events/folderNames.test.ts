import { describe, expect, it } from "vitest";

import { matching, plat, propre, same } from "./folderNames";

describe("plat", () => {
  it("retire les capitales et les accents", () => {
    expect(plat("Mérovingiens")).toBe("merovingiens");
    expect(plat("ÎLE-DE-FRANCE")).toBe("ile-de-france");
    expect(plat("Cœur")).toBe("coeur");
  });

  it("laisse intact ce qui n'en porte pas", () => {
    expect(plat("Carolingiens")).toBe("carolingiens");
  });
});

describe("propre", () => {
  it("ôte les espaces des bords et resserre ceux du milieu", () => {
    expect(propre("  Guerres  de   religion ")).toBe("Guerres de religion");
  });

  it("ne touche pas aux capitales : ce qu'on tape est le nom", () => {
    expect(propre("Empire Romain")).toBe("Empire Romain");
  });
});

describe("same", () => {
  it("rapproche deux façons d'écrire le même sujet", () => {
    expect(same("Mérovingiens", "merovingiens")).toBe(true);
    expect(same("EMPIRE ROMAIN", "Empire romain")).toBe(true);
  });

  it("sépare deux sujets différents", () => {
    expect(same("Carolingiens", "Mérovingiens")).toBe(false);
  });
});

describe("matching", () => {
  const all = ["Mérovingiens", "Carolingiens", "Empire Romain"];

  it("rend tout quand rien n'est tapé", () => {
    expect(matching(all, "   ")).toEqual(all);
  });

  it("trouve sans les accents ni les capitales", () => {
    expect(matching(all, "MEROV")).toEqual(["Mérovingiens"]);
  });

  it("cherche au milieu du nom, pas seulement au début", () => {
    expect(matching(all, "ingiens")).toEqual(["Mérovingiens", "Carolingiens"]);
  });

  it("ne rend rien quand rien ne correspond", () => {
    expect(matching(all, "Vikings")).toEqual([]);
  });
});
