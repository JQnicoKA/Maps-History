import { SafeAreaProvider } from "react-native-safe-area-context";

import { EventsProvider } from "./features/events/EventsProvider";
import { MapScreen } from "./screens/MapScreen";

export default function App() {
  return (
    <SafeAreaProvider>
      <EventsProvider>
        <MapScreen />
      </EventsProvider>
    </SafeAreaProvider>
  );
}
