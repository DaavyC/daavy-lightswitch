import { MODULE_ID, SETTINGS } from "./config.js";

export function isDebugEnabled() {
  if (typeof game === "undefined") return false;
  return game.settings.get(MODULE_ID, SETTINGS.DEBUG) === true;
}

export function debugLog(message, data = {}) {
  if (!isDebugEnabled()) return;
  console.warn(`${MODULE_ID} | DEBUG | ${message}`, data);
}

export function debugNotify(message, data = {}) {
  if (!isDebugEnabled()) return;
  console.warn(`${MODULE_ID} | DEBUG | ${message}`, data);
  ui.notifications?.info(`${MODULE_ID} DEBUG | ${message}`, { permanent: false });
}

export function reportToggleError(message, error) {
  console.error(`${MODULE_ID} | ${message}`, error);
}
