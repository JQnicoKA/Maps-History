import { useEffect, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "./components/ErrorBoundary";
import {
  AuthProvider,
  AuthScreen,
  NewPasswordScreen,
  StaleLinkScreen,
  useAuth,
} from "./features/auth";
import { EventsProvider } from "./features/events/EventsProvider";
import { NetworkProvider } from "./features/network/NetworkProvider";
import { OfflineBar } from "./features/network/OfflineBar";
import { HiddenProvider } from "./features/territories/HiddenProvider";
import { MyPlacesProvider } from "./features/places/MyPlacesProvider";
import { PlacementProvider } from "./features/placement";
import { holdMoreTiles } from "./map/cache";
import { Shell } from "./screens/Shell";
import { palette } from "./theme/palette";

export default function App() {
  // Avant toute carte, et à chaque lancement : le cache de tuiles ne garde pas
  // sa taille d'une session à l'autre — voir `holdMoreTiles`.
  useEffect(() => {
    void holdMoreTiles();
  }, []);

  return (
    <SafeAreaProvider>
      {/* Outside the providers, so a failure while loading the session or the
          collection is caught too — those are the ones that leave no screen at
          all behind them. */}
      <ErrorBoundary>
        {/* Au-dessus de tout le reste : la session elle-même se lit par le
            réseau, donc l'écran d'attente du lancement doit déjà pouvoir
            dire qu'il n'y en a pas. */}
        <NetworkProvider>
          <AuthProvider>
            <Gate />
          </AuthProvider>
        </NetworkProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

/**
 * Signed in, or not, or not yet known.
 *
 * The third state matters: the session is read from the device, which takes a
 * moment, and showing the sign-in screen during it would flash a login at
 * somebody who is already logged in.
 *
 * `EventsProvider` is keyed on the account so that changing it tears the
 * collection down and loads the new one from nothing — one reader's events can
 * never linger on another reader's map.
 *
 * A recovery is a fourth state, between the two: a session exists, but showing
 * the map would strand the reader with an account whose password is unknown.
 */
function Gate() {
  const { account, recovering, staleLink, dismissStaleLink } = useAuth();

  /**
   * Un lien de réinitialisation refusé passe avant tout le reste.
   *
   * Avant même l'attente de la session, et c'est voulu : le lien **est** ce
   * qui a lancé l'application, donc l'avertissement arrive pendant que
   * `account` vaut encore `undefined`. Placé plus bas, il aurait clignoté
   * derrière la roue d'attente puis cédé la place à l'écran de connexion,
   * c'est-à-dire au silence qu'il remplace.
   *
   * Avant la connexion aussi : un lecteur peut cliquer un vieux lien alors
   * qu'il est déjà entré, et il a droit à la même explication plutôt qu'à une
   * application qui ne réagit pas.
   */
  if (staleLink) {
    return (
      <Outside>
        <StaleLinkScreen onClose={dismissStaleLink} />
      </Outside>
    );
  }

  if (account === undefined) {
    return (
      <Outside>
        <View style={styles.waiting}>
          <ActivityIndicator color={palette.inkSoft} />
        </View>
      </Outside>
    );
  }

  if (account === null) {
    return (
      <Outside>
        <AuthScreen />
      </Outside>
    );
  }

  // Signed in by a recovery link, which proves who they are but leaves them
  // with a password nobody knows. One screen, until they have chosen one.
  if (recovering) {
    return (
      <Outside>
        <NewPasswordScreen />
      </Outside>
    );
  }

  return (
    <EventsProvider key={account.id}>
      <HiddenProvider key={account.id}>
        {/* Les territoires et les villes se chargent et se périment à des
            moments sans rapport, d'où deux réserves et non une. */}
        <MyPlacesProvider key={account.id}>
          {/* Not keyed on the account: it holds a question in flight, not
              anything belonging to a reader. */}
          <PlacementProvider>
            <Shell />
          </PlacementProvider>
        </MyPlacesProvider>
      </HiddenProvider>
    </EventsProvider>
  );
}

/**
 * Les écrans d'avant la session, avec la bande du réseau.
 *
 * `Shell` porte la sienne au-dessus des onglets ; ces trois-là sont hors de
 * la coquille et n'en avaient aucune. C'est pourtant là qu'elle manque le
 * plus : un jeton expiré renvoie à la connexion, et sans réseau on y taperait
 * son mot de passe pour recevoir une trace de pile d'Expo en guise de
 * réponse.
 */
function Outside({ children }: { children: ReactNode }) {
  return (
    <View style={styles.outside}>
      {children}
      <OfflineBar />
    </View>
  );
}

const styles = StyleSheet.create({
  outside: { flex: 1 },
  waiting: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surface,
  },
});
