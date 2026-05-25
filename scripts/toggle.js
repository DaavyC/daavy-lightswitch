import { isTruthyValue } from "./booleans.js";
import { FLAGS, MODULE_ID } from "./constants.js";
import { debugLog } from "./debug.js";

export function cloneConfig(config) {
  return structuredClone(config ?? {});
}

export function getSourceConfig(light) {
  const config = light?._source?.config
    ?? light?.toObject?.()?.config
    ?? light?.config?.toObject?.()
    ?? light?.config;

  return cloneConfig(config);
}

export function isToggleAllowed(light) {
  return isTruthyValue(light?.getFlag?.(MODULE_ID, FLAGS.PLAYER_TOGGLE_ENABLED));
}

export function isLightOff(light) {
  return light?.getFlag?.(MODULE_ID, FLAGS.IS_OFF) === true;
}

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

export function buildToggleUpdate(light) {
  if (!isToggleAllowed(light)) return null;
  return isLightOff(light) ? buildTurnOnUpdate(light) : buildTurnOffUpdate(light);
}
