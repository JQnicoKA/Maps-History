/**
 * Une passe à la fois, et toujours vers la dernière demande.
 *
 * Faire glisser la frise change d'année cinq fois par seconde. Lancer une
 * passe par année, sans jamais attendre ni annuler les précédentes, empilait
 * des dizaines de requêtes au serveur : elles finissaient toutes par dépasser
 * son délai, celle de l'année d'arrivée comprise, et la carte restait sur
 * l'ancienne planche.
 *
 * Ici, une demande arrivée pendant une passe ne part pas : elle attend la fin
 * de celle-ci, et seule la plus récente des demandes en attente est servie.
 * Les années survolées entre-temps ne coûtent donc rien.
 */
export type LatestOnly<T> = {
  /** Demande `next`. Remplace toute demande qui n'est pas encore partie. */
  want: (next: T) => void;
  /** Oublie ce qui attend ; la passe en cours se sait annulée. */
  stop: () => void;
};

export type PassState = {
  /** Une demande plus récente attend derrière celle-ci. */
  stale: () => boolean;
  /** `stop` a été appelé depuis le départ de cette passe. */
  cancelled: () => boolean;
};

export function latestOnly<T>(
  run: (wanted: T, state: PassState) => Promise<void>,
): LatestOnly<T> {
  let pending: { value: T } | null = null;
  let running = false;
  let asked = 0;
  let stops = 0;

  async function loop() {
    running = true;
    while (pending) {
      const { value } = pending;
      pending = null;
      const at = asked;
      const stoppedAt = stops;
      try {
        await run(value, {
          stale: () => asked !== at,
          cancelled: () => stops !== stoppedAt,
        });
      } catch {
        // Une passe ratée ne bloque pas les suivantes : c'est à `run` de
        // décider s'il réessaie.
      }
    }
    running = false;
  }

  return {
    want(next) {
      pending = { value: next };
      asked++;
      if (!running) void loop();
    },
    stop() {
      pending = null;
      stops++;
    },
  };
}

/** Une pause, pour laisser souffler le serveur avant de redemander. */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
