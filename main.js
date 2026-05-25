import { registerAmbientLightConfigHooks } from "./scripts/ambient-light-config.js";
import { registerCanvasIconHooks } from "./scripts/canvas-icons.js";
import { MODULE_ID } from "./scripts/constants.js";
import { registerDebugApi } from "./scripts/debug.js";
import { registerSettings } from "./scripts/settings.js";
import { registerSocket } from "./scripts/socket.js";

Hooks.once("init", () => {
  registerSettings();
});

Hooks.once("ready", () => {
  registerDebugApi();
  registerSocket();
  registerAmbientLightConfigHooks();
  registerCanvasIconHooks();
  console.info(`${MODULE_ID} | Ready`);
});
