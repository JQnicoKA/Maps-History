import { describe, expect, it } from "vitest";

import { handleProblem, isHandle } from "./profile";

describe("ce qu'un pseudonyme peut être", () => {
  it("accepte celui que la base distribue", () => {
    expect(isHandle("Scribe-1436")).toBe(true);
  });

  it("accepte les accents, les espaces et les apostrophes", () => {
    expect(isHandle("Clio de Meaux")).toBe(true);
    expect(isHandle("Géographe-1487")).toBe(true);
    expect(isHandle("Jeanne d'Arc")).toBe(true);
  });

  it("refuse trop court et trop long", () => {
    expect(handleProblem("ab")).toMatch(/au moins 3/);
    expect(handleProblem("a".repeat(25))).toMatch(/plus de 24/);
  });

  it("compte sans les espaces du bord", () => {
    expect(isHandle("   Scribe-1436   ")).toBe(true);
    expect(handleProblem("  ab  ")).toMatch(/au moins 3/);
  });

  /** A name starting with punctuation is an attempt to sort to the top. */
  it("refuse de commencer par autre chose qu'une lettre ou un chiffre", () => {
    expect(handleProblem("-tout-en-haut")).not.toBeNull();
    expect(handleProblem(" 'apostrophe")).not.toBeNull();
  });

  it("refuse la ponctuation que la base refuse", () => {
    expect(handleProblem("Scribe_1436")).not.toBeNull();
    expect(handleProblem("Scribe/1436")).not.toBeNull();
    expect(handleProblem("Scribe<b>")).not.toBeNull();
  });
});
