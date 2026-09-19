import { registerRootComponent } from "expo";

import App from "./src/App";
import { startMonitoring } from "./src/lib/monitoring";

// Before the first component is built: a crash while the app is starting is
// exactly the one nobody would otherwise hear about.
startMonitoring();

registerRootComponent(App);
