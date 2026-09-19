import { Component, type ErrorInfo, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { InkButton } from "./ui";
import { report } from "../lib/monitoring";
import { palette } from "../theme/palette";
import { radius, space, type } from "../theme/tokens";

type Props = { children: ReactNode };
type State = { failure: Error | null; attempt: number };

/**
 * The last thing standing between a bug and a white screen.
 *
 * React unmounts the whole tree when a render throws. In development that shows
 * the red screen with a stack; in a shipped build it shows nothing at all — the
 * app simply goes blank, with no message and no way back short of killing it.
 * Which is exactly the report one gets: "it closed itself".
 *
 * So the failure is caught, said out loud in the app's own hand, and the tree
 * offered again: `attempt` keys the children, so retrying rebuilds them from
 * nothing rather than re-rendering the state that just failed. A transient
 * failure — a bad answer from the network, a half-loaded record — then costs
 * one tap instead of a restart.
 *
 * A class, and it has to be: there is no hook for this.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failure: null, attempt: 0 };

  static getDerivedStateFromError(failure: Error): Partial<State> {
    return { failure };
  }

  override componentDidCatch(failure: Error, info: ErrorInfo) {
    console.error("Écran interrompu :", failure, info.componentStack);
    // The reader has been told; now tell whoever can fix it. The component
    // trail says which screen broke, which a stack trace alone rarely does.
    report(failure, { componentStack: info.componentStack });
  }

  override render() {
    const { failure, attempt } = this.state;
    if (!failure) {
      return <View key={attempt} style={styles.fill}>{this.props.children}</View>;
    }

    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.title}>Quelque chose s'est interrompu</Text>
          <Text style={styles.line}>
            L'écran n'a pas pu se dessiner. Rien n'est perdu : votre collection
            est sur le serveur, pas dans cet écran.
          </Text>

          {/* Verbatim, not prettified: this is the only trace the reader can
              copy into a message to whoever will fix it. */}
          <View style={styles.report}>
            <Text style={styles.reportText}>
              {failure.message || String(failure)}
            </Text>
          </View>

          <InkButton
            label="Réessayer"
            variant="solid"
            onPress={() =>
              this.setState((current) => ({
                failure: null,
                attempt: current.attempt + 1,
              }))
            }
          />
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  screen: { flex: 1, backgroundColor: palette.paper },
  body: {
    flexGrow: 1,
    justifyContent: "center",
    gap: space.lg,
    padding: space.xl,
  },
  title: { ...type.title, fontWeight: "700", color: palette.ink },
  line: { ...type.body, color: palette.inkSoft },
  report: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.sunken,
  },
  reportText: { ...type.caption, color: palette.inkSoft },
});
