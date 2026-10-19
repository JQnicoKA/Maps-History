import NetInfo from "@react-native-community/netinfo";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Network = {
  /**
   * Si l'appareil atteint vraiment l'internet.
   *
   * **Trois valeurs et non deux.** `null` veut dire « on ne sait pas
   * encore » : la première réponse de NetInfo arrive après le premier rendu,
   * et partir de `false` ferait clignoter un bandeau « hors ligne » au
   * lancement de chaque session, y compris les bonnes. Tant qu'on ignore, on
   * ne dit rien.
   */
  online: boolean | null;
};

const Reach = createContext<Network | null>(null);

/**
 * Ce que l'appareil sait de sa connexion.
 *
 * **Pourquoi il ne suffit pas d'attendre qu'une requête échoue.** Un appel
 * mort apprend trois choses à la fois — qu'il a échoué, qu'on ne sait pas
 * pourquoi, et qu'il faudra deviner quand réessayer. Savoir d'avance qu'on
 * est hors ligne permet de le **dire** avant de faire perdre son temps au
 * lecteur, de distinguer « pas de réseau » de « le serveur a refusé », et
 * surtout de recharger **à l'instant où le réseau revient** plutôt que
 * d'attendre qu'on appuie sur un bouton.
 *
 * `isInternetReachable` plutôt qu'`isConnected`, et c'est la distinction qui
 * compte : un portail captif d'hôtel ou d'aéroport donne une interface
 * parfaitement connectée qui ne mène nulle part. Quand NetInfo ne sait pas
 * encore l'atteindre, on se rabat sur la présence d'une interface — c'est la
 * meilleure réponse disponible, et elle vaut mieux que `null` prolongé.
 */
export function NetworkProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const stop = NetInfo.addEventListener((state) => {
      setOnline(state.isInternetReachable ?? state.isConnected);
    });
    return stop;
  }, []);

  return <Reach.Provider value={{ online }}>{children}</Reach.Provider>;
}

export function useNetwork(): Network {
  const found = useContext(Reach);
  if (found === null) {
    throw new Error("useNetwork hors de NetworkProvider");
  }
  return found;
}

/**
 * Appelle ceci au moment précis où le réseau revient, et à ce moment seul.
 *
 * **Sur la transition et non sur l'état**, parce qu'un effet qui dirait
 * simplement « en ligne et en erreur, donc recharge » tournerait en rond :
 * une tentative qui échoue laisse l'erreur en place et la connexion debout,
 * et rien ne distinguerait le second passage du premier.
 *
 * Le premier verdict ne compte pas comme un retour : au lancement on passe
 * de « on ne sait pas » à « en ligne », ce qui n'est pas un rétablissement —
 * et le chargement initial a déjà lieu de son côté.
 */
export function useReconnected(deed: () => void) {
  const { online } = useNetwork();
  const wasOffline = useRef(false);
  const latest = useRef(deed);
  latest.current = deed;

  useEffect(() => {
    if (online === false) {
      wasOffline.current = true;
      return;
    }
    if (online === true && wasOffline.current) {
      wasOffline.current = false;
      latest.current();
    }
  }, [online]);
}
