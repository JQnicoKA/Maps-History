import { describe, expect, it } from "vitest";

import { VARIANTS, variantOf } from "./variants";

/**
 * La table que `app.config.ts` et `env.ts` partagent.
 *
 * Elle est éprouvée parce qu'elle a déjà coûté une panne : les deux fichiers
 * calculaient le schéma chacun de leur côté, l'un rendait `mapshistory-dev` et
 * l'autre `mapshistory-development`. Le système ne reconnaissait donc pas le
 * schéma que l'application réclamait, et toute connexion par navigateur
 * revenait sur le site du projet au lieu de l'application.
 */
describe("les variantes", () => {
  it("donne à chacune son propre schéma", () => {
    const schemes = Object.values(VARIANTS).map((one) => one.scheme);
    expect(new Set(schemes).size).toBe(schemes.length);
  });

  it("donne à chacune son propre suffixe de bundle", () => {
    const suffixes = Object.values(VARIANTS).map((one) => one.suffix);
    expect(new Set(suffixes).size).toBe(suffixes.length);
  });

  it("laisse la production sans suffixe ni tiret", () => {
    expect(VARIANTS.production.suffix).toBe("");
    expect(VARIANTS.production.scheme).toBe("mapshistory");
  });

  it("abrège le développement en « dev », et surtout pas en « development »", () => {
    /* La faute d'autrefois, nommée. `env.ts` recollait le nom de la variante
       au préfixe et réclamait `mapshistory-development` ; `app.config.ts`
       déclarait `mapshistory-dev`. Rien sur le téléphone ne répondait au
       premier, et toute connexion par navigateur revenait sur le site du
       projet. Ce test-ci est le seul qui aurait attrapé la divergence. */
    expect(VARIANTS.development.scheme).toBe("mapshistory-dev");
    expect(VARIANTS.development.scheme).not.toBe("mapshistory-development");
  });

  it("retombe sur la production devant l'inconnu", () => {
    expect(variantOf(undefined)).toBe("production");
    expect(variantOf("")).toBe("production");
    expect(variantOf("staging")).toBe("production");
  });

  it("reconnaît les trois, espaces compris", () => {
    expect(variantOf("development")).toBe("development");
    expect(variantOf(" preview ")).toBe("preview");
    expect(variantOf("production")).toBe("production");
  });
});
