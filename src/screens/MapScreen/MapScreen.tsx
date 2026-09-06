import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";

import { MissingApiKeyNotice } from "./MissingApiKeyNotice";
import { WorldMap } from "../../components/WorldMap";
import { env } from "../../config/env";
import { palette } from "../../theme/palette";

/** Full-bleed map. No chrome, by design. */
export function MapScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      {env.hasMapTilerApiKey ? <WorldMap /> : <MissingApiKeyNotice />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper },
});
