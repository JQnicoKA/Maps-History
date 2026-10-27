import { useEffect, useState } from "react";

/**
 * Ne dit vrai que si c'est vrai depuis un moment.
 *
 * **Le pendant de `useLingering`**, qui garde une valeur partie le temps qu'un
 * panneau s'en aille : celui-ci retient une valeur arrivée le temps de savoir
 * si elle vaut la peine d'être montrée.
 *
 * C'est le crochet d'une roue qui tourne. Un travail qui s'achève en cinquante
 * millisecondes n'a pas besoin d'être annoncé — l'annoncer ferait clignoter un
 * témoin, ce qui est plus inquiétant que le silence. On ne le dit que si
 * l'attente dure assez pour qu'un lecteur se demande si quelque chose est
 * cassé.
 *
 * Le retour à faux est immédiat et doit l'être : une roue qui s'attarde après
 * la fin du travail mentirait, et c'est exactement ce qu'on cherche à éviter.
 */
export function usePatience(waiting: boolean, afterMs = 300): boolean {
  const [said, setSaid] = useState(false);

  useEffect(() => {
    if (!waiting) {
      setSaid(false);
      return;
    }
    const timer = setTimeout(() => setSaid(true), afterMs);
    return () => clearTimeout(timer);
  }, [waiting, afterMs]);

  return said;
}
