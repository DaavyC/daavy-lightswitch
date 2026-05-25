import { isTruthyValue } from "./booleans.js";
import { FLAGS, MODULE_ID } from "./constants.js";
import { debugLog } from "./debug.js";

// Clones a configuration object safely.
export function cloneConfig(config) {
  return structuredClone(config ?? {});
}

// Retrieves the source configuration of a light document.
export function getSourceConfig(light) {
  const config = light?._source?.config
    ?? light?.toObject?.()?.config
    ?? light?.config?.toObject?.()
    ?? light?.config;

  return cloneConfig(config);
}

// Checks if the player is allowed to toggle the light.
export function isToggleAllowed(light) {
  return isTruthyValue(light?.getFlag?.(MODULE_ID, FLAGS.PLAYER_TOGGLE_ENABLED));
}

// Checks if the light is currently turned off.
export function isLightOff(light) {
  return light?.getFlag?.(MODULE_ID, FLAGS.IS_OFF) === true;
}

// Builds the update payload to turn off the light and save its current config.
export function buildTurnOffUpdate(light) {
  const config = getSourceConfig(light);
  const update = {
    hidden: true,
    [`flags.${MODULE_ID}.${FLAGS.IS_OFF}`]: true,
    [`flags.${MODULE_ID}.${FLAGS.RESTORE_CONFIG}`]: config
  };
  debugLog("build turn off update", { lightId: light?.id, update });
  return update;
}

// Builds the update payload to turn on the light and restore its original config.
export function buildTurnOnUpdate(light) {
  const restoreConfig = light?.getFlag?.(MODULE_ID, FLAGS.RESTORE_CONFIG);
  const update = {
    hidden: false,
    [`flags.${MODULE_ID}.${FLAGS.IS_OFF}`]: false,
    [`flags.${MODULE_ID}.-=${FLAGS.RESTORE_CONFIG}`]: null
  };

  if (restoreConfig && typeof restoreConfig === "object") {
    update.config = cloneConfig(restoreConfig);
  }

  return update;
}

// Generates the appropriate toggle update payload based on the light's current state.
export function buildToggleUpdate(light) {
  if (!isToggleAllowed(light)) return null;
  return isLightOff(light) ? buildTurnOnUpdate(light) : buildTurnOffUpdate(light);
}
