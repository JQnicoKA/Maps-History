import { describe, expect, it } from "vitest";

import type { StudyTerritory } from "./api";
import { BLANK_SETUP, aimAt, gather, type StudySetup } from "./subjects";
import type { Character, EventSummary, Importance } from "../events/types";

/**
 * Un événement réduit à ce que l'étude lui demande.
 *
 * Le cast est assumé : `EventSummary` porte une quinzaine de champs — la
 * couverture, les photos, l'origine, le partage — dont pas un n'entre dans le
 * tamis d'une étude. Les écrire tous ferait des fixtures où l'on ne verrait
 * plus ce que le test règle.
 */
function anEvent(
  id: string,
  year: number,
  folders: string[] = [],
  importance: Importance = "medium",
): EventSummary {
  return {
    id,
    title: `Événement ${id}`,
    start: { year },
    end: null,
    longitude: 2,
    latitude: 48,
    folders,
    importance,
  } as EventSummary;
}

function aPerson(
  id: string,
  year: number | null,
  placed = true,
  folders: string[] = [],
  importance: Importance = "medium",
): Character {
  return {
    id,
    name: `Personne ${id}`,
    birth: year === null ? null : { year },
    death: null,
    longitude: placed ? 2 : null,
    latitude: placed ? 48 : null,
    folders,
    importance,
  } as Character;
}

function aTerritory(id: string, from: number): StudyTerritory {
  return { id, name: `Pays ${id}`, from, to: from + 100 };
}

const nothing = { events: [], characters: [], territories: [] };

describe("aimAt", () => {
  it("cumule les événements et les personnages", () => {
    expect(aimAt(["events"], "characters")).toEqual(["events", "characters"]);
  });

  it("décoche ce qui était coché", () => {
    expect(aimAt(["events", "characters"], "events")).toEqual(["characters"]);
  });

  it("range les deux autres quand on choisit les territoires", () => {
    expect(aimAt(["events", "characters"], "territories")).toEqual([
      "territories",
    ]);
  });

  it("range les territoires quand on choisit autre chose", () => {
    expect(aimAt(["territories"], "events")).toEqual(["events"]);
  });

  it("laisse tout décocher, ce qui regrise « Suivant »", () => {
    expect(aimAt(["territories"], "territories")).toEqual([]);
    expect(aimAt(["events"], "events")).toEqual([]);
  });
});

describe("gather", () => {
  const setup = (over: Partial<StudySetup> = {}): StudySetup => ({
    ...BLANK_SETUP,
    ...over,
  });

  it("ne rassemble rien sans but", () => {
    expect(gather(setup(), { ...nothing, events: [anEvent("a", 1000)] }).pool)
      .toEqual([]);
  });

  it("réduit un événement à son titre et son année", () => {
    const { pool } = gather(setup({ aims: ["events"] }), {
      ...nothing,
      events: [anEvent("a", 1453)],
    });
    expect(pool).toEqual([{ id: "a", label: "Événement a", at: 1453 }]);
  });

  it("écarte les personnages qui ne sont pas sur la carte", () => {
    const { pool } = gather(setup({ aims: ["characters"] }), {
      ...nothing,
      characters: [aPerson("placé", 500), aPerson("nulle part", 500, false)],
    });
    expect(pool.map((one) => one.id)).toEqual(["placé"]);
  });

  it("écarte les personnages sans naissance, qui n'ont pas de date à montrer", () => {
    const { pool } = gather(setup({ aims: ["characters"] }), {
      ...nothing,
      characters: [aPerson("daté", 500), aPerson("sans date", null)],
    });
    expect(pool.map((one) => one.id)).toEqual(["daté"]);
  });

  it("mêle les événements et les personnages", () => {
    const { pool } = gather(setup({ aims: ["events", "characters"] }), {
      ...nothing,
      events: [anEvent("e", 800)],
      characters: [aPerson("p", 900)],
    });
    expect(pool.map((one) => one.id).sort()).toEqual(["e", "p"]);
  });

  it("tamise par classeur, et garde tout le reste pour les leurres", () => {
    const stock = {
      ...nothing,
      events: [
        anEvent("dedans", 1000, ["Mérovingiens"]),
        anEvent("dehors", 1001, ["Capétiens"]),
        anEvent("nulle part", 1002),
      ],
    };

    const { pool, everything } = gather(
      setup({ aims: ["events"], folders: ["Mérovingiens"] }),
      stock,
    );

    expect(pool.map((one) => one.id)).toEqual(["dedans"]);
    expect(everything.map((one) => one.id)).toEqual([
      "dedans",
      "dehors",
      "nulle part",
    ]);
  });

  it("retient un événement rangé dans l'un des classeurs demandés", () => {
    const { pool } = gather(
      setup({ aims: ["events"], folders: ["A", "B"] }),
      { ...nothing, events: [anEvent("deux", 1000, ["B", "C"])] },
    );
    expect(pool.map((one) => one.id)).toEqual(["deux"]);
  });

  it("tamise par importance", () => {
    const { pool } = gather(
      setup({ aims: ["events"], importance: ["high", "low"] }),
      {
        ...nothing,
        events: [
          anEvent("haute", 1000, [], "high"),
          anEvent("moyenne", 1001, [], "medium"),
          anEvent("basse", 1002, [], "low"),
        ],
      },
    );
    expect(pool.map((one) => one.id)).toEqual(["haute", "basse"]);
  });

  it("cumule les deux tamis", () => {
    const { pool } = gather(
      setup({ aims: ["events"], folders: ["A"], importance: ["high"] }),
      {
        ...nothing,
        events: [
          anEvent("les deux", 1000, ["A"], "high"),
          anEvent("le bon classeur", 1001, ["A"], "low"),
          anEvent("la bonne importance", 1002, ["B"], "high"),
        ],
      },
    );
    expect(pool.map((one) => one.id)).toEqual(["les deux"]);
  });

  it("ne tamise pas les territoires par classeur ni par importance", () => {
    const { pool } = gather(
      setup({
        aims: ["territories"],
        folders: ["A"],
        importance: ["high"],
      }),
      { ...nothing, territories: [aTerritory("t", 800)] },
    );
    expect(pool).toEqual([{ id: "t", label: "Pays t", at: 800 }]);
  });

  it("retient les territoires qui chevauchent la fenêtre", () => {
    // `aTerritory` dure cent ans à partir de l'année donnée.
    const { pool } = gather(
      setup({ aims: ["territories"], window: { from: 1000, to: 1100 } }),
      {
        ...nothing,
        territories: [
          aTerritory("avant", 800), // 800-900, fini avant
          aTerritory("à cheval", 950), // 950-1050, entre dedans
          aTerritory("dedans", 1020), // 1020-1120
          aTerritory("après", 1200), // 1200-1300, pas encore
        ],
      },
    );
    expect(pool.map((one) => one.id)).toEqual(["à cheval", "dedans"]);
  });

  it("retient un territoire qui dépasse la fenêtre des deux côtés", () => {
    // Un empire de mille ans a bien existé en 1050 : l'écarter reviendrait à
    // écarter les plus durables, c'est-à-dire ceux qu'on connaît.
    const { pool } = gather(
      setup({ aims: ["territories"], window: { from: 1000, to: 1100 } }),
      { ...nothing, territories: [{ id: "long", name: "Empire", from: 500, to: 1500 }] },
    );
    expect(pool.map((one) => one.id)).toEqual(["long"]);
  });

  it("garde hors fenêtre tous les territoires de la partie, pour les leurres", () => {
    // L'Afrique entre 800 et 1200 ne compte que quatre noms : sans ce vivier,
    // les quatre mêmes propositions reviendraient à chaque question.
    const { pool, everything } = gather(
      setup({ aims: ["territories"], window: { from: 1000, to: 1100 } }),
      {
        ...nothing,
        territories: [aTerritory("dedans", 1020), aTerritory("hors", 200)],
      },
    );

    expect(pool.map((one) => one.id)).toEqual(["dedans"]);
    expect(everything.map((one) => one.id)).toEqual(["dedans", "hors"]);
  });

  it("interroge toute la partie du monde quand on ne borne pas les années", () => {
    const { pool } = gather(setup({ aims: ["territories"], window: null }), {
      ...nothing,
      territories: [aTerritory("a", -500), aTerritory("b", 1900)],
    });
    expect(pool.map((one) => one.id)).toEqual(["a", "b"]);
  });

  it("rend le chemin de retour vers la chose interrogée", () => {
    const event = anEvent("a", 1000);
    const { quarry } = gather(setup({ aims: ["events"] }), {
      ...nothing,
      events: [event],
    });

    const found = quarry.get("a");
    expect(found?.kind).toBe("event");
    expect(found?.kind === "event" ? found.event : null).toBe(event);
  });
});
