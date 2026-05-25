import { isTruthyValue } from "./booleans.js";
import { FLAGS, MODULE_ID } from "./constants.js";
import { getPlayerToggleDefault } from "./settings.js";

const FLAG_PATH = `flags.${MODULE_ID}.${FLAGS.PLAYER_TOGGLE_ENABLED}`;

// Registers hooks for ambient light configurations (creation, update, and configuration sheet rendering).
export function registerAmbientLightConfigHooks() {
  Hooks.on("preCreateAmbientLight", setDefaultPlayerToggleFlag);
  Hooks.on("preUpdateAmbientLight", normalizePlayerToggleFlag);
  Hooks.on("renderAmbientLightConfig", addPlayerToggleField);
}

// Sets the default player toggle flag when a new ambient light is created.
export function setDefaultPlayerToggleFlag(document, data) {
  const currentValue = getFlagUpdateValue(data);
  const value = currentValue === undefined ? getPlayerToggleDefault() : isTruthyValue(currentValue);

  document.updateSource?.({ [FLAG_PATH]: value });
  foundry.utils.setProperty(data, FLAG_PATH, value);
}

// Normalizes the player toggle flag to a boolean value during document updates.
export function normalizePlayerToggleFlag(document, change) {
  normalizeFlattenedFlag(change);
  normalizeNestedFlag(change);
}

// Normalizes the flag when it is passed as a flattened property.
function normalizeFlattenedFlag(change) {
  if (Object.hasOwn(change, FLAG_PATH)) change[FLAG_PATH] = isTruthyValue(change[FLAG_PATH]);
}

// Normalizes the flag when it is passed as a nested object property.
function normalizeNestedFlag(change) {
  if (foundry.utils.hasProperty(change, FLAG_PATH)) {
    foundry.utils.setProperty(change, FLAG_PATH, isTruthyValue(foundry.utils.getProperty(change, FLAG_PATH)));
  }
}

// Injects the player toggle setting checkbox into the ambient light configuration sheet.
export function addPlayerToggleField(app, html) {
  if (!game.user.isGM) return;

  const element = typeof HTMLElement !== "undefined" && html instanceof HTMLElement ? html : html?.[0];
  if (!element) return;

  const currentValue = getDocumentPlayerToggleValue(app.document);
  const checked = currentValue ?? getPlayerToggleDefault();
  const inputs = createBooleanInputs(checked);
  const group = createFormGroup(inputs.checkbox);
  const target = findFieldTarget(element);

  if (!target) return;
  group.prepend(inputs.hidden);
  target.append(group);
  app.setPosition?.();
}

// Creates the hidden and checkbox inputs for the boolean toggle flag.
function createBooleanInputs(checked) {
  const hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.name = FLAG_PATH;
  hidden.value = "false";
  hidden.dataset.dtype = "Boolean";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.name = FLAG_PATH;
  input.value = "true";
  input.checked = checked;
  input.dataset.dtype = "Boolean";

  return {
    hidden,
    checkbox: input
  };
}

// Formats and builds the form-group UI container using modern Foundry or legacy fallback methods.
function createFormGroup(input) {
  if (foundry.applications?.fields?.createFormGroup) return createFoundryFormGroup(input);
  return createFallbackFormGroup(input);
}

// Creates a form-group container using the modern Foundry Application API.
function createFoundryFormGroup(input) {
  return foundry.applications.fields.createFormGroup({
    input,
    label: `${MODULE_ID}.ambientLightConfig.playerToggleEnabled.label`,
    hint: `${MODULE_ID}.ambientLightConfig.playerToggleEnabled.hint`,
    localize: true
  });
}

// Creates a form-group container using legacy HTML element construction.
function createFallbackFormGroup(input) {
  const group = document.createElement("div");
  group.className = "form-group";

  const label = document.createElement("label");
  label.textContent = game.i18n.localize(`${MODULE_ID}.ambientLightConfig.playerToggleEnabled.label`);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = game.i18n.localize(`${MODULE_ID}.ambientLightConfig.playerToggleEnabled.hint`);

  group.append(label, input, hint);
  return group;
}

// Locates the appropriate target container inside the sheet form to append the toggle setting.
function findFieldTarget(element) {
  return element.querySelector("form .tab[data-tab='basic']")
    ?? element.querySelector("form .tab.active")
    ?? element.querySelector("form .tab")
    ?? element.querySelector("form")
    ?? element;
}

// Retrieves the current player toggle flag value from an ambient light document.
function getDocumentPlayerToggleValue(document) {
  const value = document.getFlag(MODULE_ID, FLAGS.PLAYER_TOGGLE_ENABLED);
  if (value === undefined) return undefined;
  return isTruthyValue(value);
}

// Extracts the flag value from a raw update data object, checking both nested and flattened paths.
function getFlagUpdateValue(data) {
  if (Object.hasOwn(data, FLAG_PATH)) return data[FLAG_PATH];
  if (!foundry.utils.hasProperty(data, FLAG_PATH)) return undefined;
  return foundry.utils.getProperty(data, FLAG_PATH);
}
