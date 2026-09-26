import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "./components/ErrorBoundary";
import {
  AuthProvider,
  AuthScreen,
  NewPasswordScreen,
  useAuth,
} from "./features/auth";
import { EventsProvider } from "./features/events/EventsProvider";
import { HiddenProvider } from "./features/territories/HiddenProvider";
import { MapScreen } from "./screens/MapScreen";
import { palette } from "./theme/palette";

export default function App() {
  return (
    <SafeAreaProvider>
      {/* Outside the providers, so a failure while loading the session or the
          collection is caught too — those are the ones that leave no screen at
          all behind them. */}
      <ErrorBoundary>
        <AuthProvider>
          <Gate />
        </AuthProvider>
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
  const { account, recovering } = useAuth();

  if (account === undefined) {
    return (
      <View style={styles.waiting}>
        <ActivityIndicator color={palette.inkSoft} />
      </View>
    );
  }

  if (account === null) return <AuthScreen />;

  // Signed in by a recovery link, which proves who they are but leaves them
  // with a password nobody knows. One screen, until they have chosen one.
  if (recovering) return <NewPasswordScreen />;

  return (
    <EventsProvider key={account.id}>
      <HiddenProvider key={account.id}>
        <MapScreen />
      </HiddenProvider>
    </EventsProvider>
  );
}

const styles = StyleSheet.create({
  waiting: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.paper,
  },
});
