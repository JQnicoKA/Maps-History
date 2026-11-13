import { describe, expect, it } from "vitest";

import { latestOnly } from "./latestOnly";

/** Une promesse que le test résout quand il veut. */
function gate() {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => (open = resolve));
  return { promise, open };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("latestOnly", () => {
  it("ne lance qu'une passe à la fois et saute les demandes intermédiaires", async () => {
    const started: number[] = [];
    const gates: ReturnType<typeof gate>[] = [];
    const pump = latestOnly<number>(async (year) => {
      started.push(year);
      const g = gate();
      gates.push(g);
      await g.promise;
    });

    pump.want(400);
    pump.want(600);
    pump.want(1200);
    pump.want(2000);
    await flush();
    expect(started).toEqual([400]);

    gates[0]!.open();
    await flush();
    expect(started).toEqual([400, 2000]);

    gates[1]!.open();
    await flush();
    expect(started).toEqual([400, 2000]);
  });

  it("dit à la passe en cours qu'une demande plus récente attend", async () => {
    const seen: boolean[] = [];
    const g = gate();
    const pump = latestOnly<number>(async (year, { stale }) => {
      if (year === 1) await g.promise;
      seen.push(stale());
    });

    pump.want(1);
    await flush();
    pump.want(2);
    g.open();
    await flush();
    await flush();
    expect(seen).toEqual([true, false]);
  });

  it("oublie la demande en attente après stop, et le signale", async () => {
    const started: number[] = [];
    let cancelledSeen = false;
    const g = gate();
    const pump = latestOnly<number>(async (year, { cancelled }) => {
      started.push(year);
      if (year === 1) {
        await g.promise;
        cancelledSeen = cancelled();
      }
    });

    pump.want(1);
    await flush();
    pump.want(2);
    pump.stop();
    g.open();
    await flush();
    expect(started).toEqual([1]);
    expect(cancelledSeen).toBe(true);
  });

  it("continue après une passe qui échoue", async () => {
    const started: number[] = [];
    const pump = latestOnly<number>(async (year) => {
      started.push(year);
      if (year === 1) throw new Error("délai dépassé");
    });

    pump.want(1);
    await flush();
    pump.want(2);
    await flush();
    expect(started).toEqual([1, 2]);
  });
});
