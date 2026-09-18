import { describe, expect, it } from "vitest";

import { failures, isStrong, looksLikeEmail, MIN_LENGTH, RULES, strength } from "./password";

describe("ce qui fait un mot de passe", () => {
  it("refuse le vide sur les quatre règles", () => {
    expect(failures("")).toHaveLength(RULES.length);
  });

  it("refuse court, même bien mélangé", () => {
    expect(isStrong("Test123")).toBe(false);
    expect(failures("Test123").map((rule) => rule.label)).toEqual([
      `${MIN_LENGTH} caractères ou plus`,
    ]);
  });

  it("refuse long mais uniforme", () => {
    expect(isStrong("motdepasselong")).toBe(false);
    expect(isStrong("MOTDEPASSELONG")).toBe(false);
    expect(isStrong("MotDePasseLong")).toBe(false);
    expect(isStrong("motdepasse1789")).toBe(false);
  });

  it("accepte les quatre règles réunies", () => {
    expect(isStrong("MotDePasse1789")).toBe(true);
  });

  it("compte les lettres accentuées comme des lettres", () => {
    expect(isStrong("Éléphant2026")).toBe(true);
  });
});

describe("la jauge", () => {
  it("monte avec les règles satisfaites", () => {
    expect(strength("m")).toBeLessThan(strength("Mot1"));
    expect(strength("Mot1")).toBeLessThan(strength("MotDePasse1"));
  });

  it("part de zéro et ne dépasse pas un", () => {
    expect(strength("")).toBe(0);
    expect(strength("MotDePasseVraimentTresLong1789")).toBe(1);
  });

  it("ne donne pas la note maximale à un passage tout juste réussi", () => {
    expect(isStrong("Motdepa1")).toBe(true);
    expect(strength("Motdepa1")).toBeLessThan(1);
  });
});

describe("l'allure d'une adresse", () => {
  it("accepte une adresse ordinaire, espaces compris", () => {
    expect(looksLikeEmail("testmaps@gmail.com")).toBe(true);
    expect(looksLikeEmail("  testmaps@gmail.com ")).toBe(true);
  });

  it("refuse ce qui n'en a pas la forme", () => {
    expect(looksLikeEmail("testmaps.gmail.com")).toBe(false);
    expect(looksLikeEmail("testmaps@gmail")).toBe(false);
    expect(looksLikeEmail("test maps@gmail.com")).toBe(false);
    expect(looksLikeEmail("")).toBe(false);
  });
});
