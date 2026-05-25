import { FLAGS, MODULE_ID } from "./constants.js";
import { getPlayerToggleDefault } from "./settings.js";

const FLAG_PATH = `flags.${MODULE_ID}.${FLAGS.PLAYER_TOGGLE_ENABLED}`;

export function registerAmbientLightConfigHooks() {
  Hooks.on("preCreateAmbientLight", setDefaultPlayerToggleFlag);
  Hooks.on("preUpdateAmbientLight", normalizePlayerToggleFlag);
  Hooks.on("renderAmbientLightConfig", addPlayerToggleField);
}

export function setDefaultPlayerToggleFlag(document, data) {
  const hasValue = foundry.utils.hasProperty(data, FLAG_PATH);
  if (!hasValue) {
    foundry.utils.setProperty(data, FLAG_PATH, getPlayerToggleDefault());
    return;
  }

  foundry.utils.setProperty(data, FLAG_PATH, toBoolean(foundry.utils.getProperty(data, FLAG_PATH)));
}

export function normalizePlayerToggleFlag(document, change) {
  if (!foundry.utils.hasProperty(change, FLAG_PATH)) return;
  foundry.utils.setProperty(change, FLAG_PATH, toBoolean(foundry.utils.getProperty(change, FLAG_PATH)));
}

export function addPlayerToggleField(app, html) {
  if (!game.user.isGM) return;

  const element = html instanceof HTMLElement ? html : html?.[0];
  if (!element) return;

  const currentValue = getDocumentPlayerToggleValue(app.document);
  const checked = currentValue ?? getPlayerToggleDefault();
  const inputs = createBooleanInputs(checked);
  const group = createFormGroup(inputs.checkbox);
  const target = findFieldTarget(element);

  if (!target) return;
  inputs.checkbox.addEventListener("change", () => {
    app.document.setFlag(MODULE_ID, FLAGS.PLAYER_TOGGLE_ENABLED, inputs.checkbox.checked);
  });
  group.prepend(inputs.hidden);
  target.append(group);
  app.setPosition?.();
}

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

function createFormGroup(input) {
  if (foundry.applications?.fields?.createFormGroup) {
    return foundry.applications.fields.createFormGroup({
      input,
      label: `${MODULE_ID}.ambientLightConfig.playerToggleEnabled.label`,
      hint: `${MODULE_ID}.ambientLightConfig.playerToggleEnabled.hint`,
      localize: true
    });
  }

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

function findFieldTarget(element) {
  return element.querySelector("form .tab[data-tab='basic']")
    ?? element.querySelector("form .tab.active")
    ?? element.querySelector("form .tab")
    ?? element.querySelector("form")
    ?? element;
}

function getDocumentPlayerToggleValue(document) {
  const value = document.getFlag(MODULE_ID, FLAGS.PLAYER_TOGGLE_ENABLED);
  if (value === undefined) return undefined;
  return toBoolean(value);
}

function toBoolean(value) {
  if (Array.isArray(value)) return value.some((entry) => toBoolean(entry));

  if (value === true || value === "true" || value === 1 || value === "1" || value === "on") {
    return true;
  }

  return false;
}
