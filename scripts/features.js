import { FLAGS, MODULE_ID, TOGGLE_QUERY } from "./config.js";
import { cloneConfig, getHTMLElement, isTruthyValue } from "./utils.js";
import { debugLog, debugNotify, reportToggleError } from "./debug.js";
import { getPlayerToggleDefault, shouldShowForGM } from "./settings.js";

const AMBIENT_LIGHT_TYPE = "AmbientLight";
const PLAYER_TOGGLE_PATH = `flags.${MODULE_ID}.${FLAGS.PLAYER_TOGGLE_ENABLED}`;
const IS_OFF_PATH = `flags.${MODULE_ID}.${FLAGS.IS_OFF}`;
const RESTORE_CONFIG_PATH = `flags.${MODULE_ID}.${FLAGS.RESTORE_CONFIG}`;
const DELETE_RESTORE_CONFIG_PATH = `flags.${MODULE_ID}.-=${FLAGS.RESTORE_CONFIG}`;
const SWITCH_LAYER_NAME = "daavyLightswitchLayer";
const SWITCH_SIZE = 28;
const HIT_SIZE = 42;

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
  const update = {
    hidden: true,
    [IS_OFF_PATH]: true,
    [RESTORE_CONFIG_PATH]: getSourceConfig(light)
  };
  debugLog("build turn off update", { lightId: light?.id, update });
  return update;
}

export function buildTurnOnUpdate(light) {
  const restoreConfig = light?.getFlag?.(MODULE_ID, FLAGS.RESTORE_CONFIG);
  const update = {
    hidden: false,
    [IS_OFF_PATH]: false,
    [DELETE_RESTORE_CONFIG_PATH]: null
  };

  if (restoreConfig && typeof restoreConfig === "object") update.config = cloneConfig(restoreConfig);
  return update;
}

export function buildToggleUpdate(light) {
  if (!isToggleAllowed(light)) return null;
  return isLightOff(light) ? buildTurnOnUpdate(light) : buildTurnOffUpdate(light);
}

export function registerSocket() {
  CONFIG.queries[TOGGLE_QUERY] = handleToggleLightQuery;
  debugLog("query registered", { query: TOGGLE_QUERY, userId: game.user.id, isGM: game.user.isGM });
}

export async function requestLightToggle(light) {
  const ids = {
    sceneId: light?.scene?.id ?? canvas.scene?.id,
    lightId: light?.id
  };

  if (!ids.sceneId || !ids.lightId) {
    debugNotify("light request missing ids", ids);
    return { ok: false, reason: "missing-ids" };
  }

  if (light?.canUserModify?.(game.user, "update") === true) return applyDirectToggle(light);
  return queryActiveGM(ids);
}

async function queryActiveGM(payload) {
  const gm = game.users.find((user) => user.active && user.isGM);
  if (!gm) {
    debugNotify("no active GM for light query", payload);
    return { ok: false, reason: "no-active-gm" };
  }

  try {
    const result = await gm.query(TOGGLE_QUERY, payload, { timeout: 5000 });
    debugLog("GM light query result", { gmId: gm.id, result });
    return result;
  } catch (error) {
    debugNotify("GM light query failed", {
      sceneId: payload.sceneId,
      lightId: payload.lightId,
      message: error.message
    });
    return { ok: false, reason: "query-failed" };
  }
}

async function applyDirectToggle(light) {
  const update = buildValidatedToggleUpdate(light, game.user, { allowGM: true });
  debugLog("direct update path", { lightId: light.id, update });
  if (!update) return { ok: false, reason: "rejected" };
  await light.update(update);
  return { ok: true, direct: true };
}

export async function handleToggleLightQuery(payload, { user } = {}) {
  debugLog("toggle light query received", {
    payload,
    requesterId: user?.id,
    receiverId: game.user.id,
    isGM: game.user.isGM
  });

  if (!game.user.isGM) return { ok: false, reason: "not-gm" };

  const scene = game.scenes.get(payload?.sceneId);
  const light = scene?.getEmbeddedDocument?.(AMBIENT_LIGHT_TYPE, payload?.lightId)
    ?? scene?.lights?.get?.(payload?.lightId)
    ?? scene?.collections?.get(AMBIENT_LIGHT_TYPE)?.get(payload?.lightId)
    ?? null;
  const update = buildValidatedToggleUpdate(light, user);

  if (!scene || !light || !update) {
    debugNotify("toggle light query rejected", {
      sceneId: payload?.sceneId,
      lightId: payload?.lightId,
      hasScene: Boolean(scene),
      hasLight: Boolean(light),
      hasUser: Boolean(user),
      userIsGM: user?.isGM
    });
    return { ok: false, reason: "rejected" };
  }

  debugNotify("GM applying light update", { sceneId: scene.id, lightId: light.id, update });
  await scene.updateEmbeddedDocuments(AMBIENT_LIGHT_TYPE, [{ _id: light.id, ...update }]);
  return { ok: true };
}

export function buildValidatedToggleUpdate(light, user, { allowGM = false } = {}) {
  if (!light || !user) return null;
  if (user.isGM && !allowGM) return null;
  return buildToggleUpdate(light);
}

export function setDefaultPlayerToggleFlag(document, creationData) {
  const currentValue = getFlagUpdateValue(creationData);
  const value = currentValue === undefined ? getPlayerToggleDefault() : isTruthyValue(currentValue);

  document.updateSource?.({ [PLAYER_TOGGLE_PATH]: value });
  foundry.utils.setProperty(creationData, PLAYER_TOGGLE_PATH, value);
}

export function normalizePlayerToggleFlag(document, change) {
  if (Object.hasOwn(change, PLAYER_TOGGLE_PATH)) change[PLAYER_TOGGLE_PATH] = isTruthyValue(change[PLAYER_TOGGLE_PATH]);
  if (foundry.utils.hasProperty(change, PLAYER_TOGGLE_PATH)) {
    foundry.utils.setProperty(change, PLAYER_TOGGLE_PATH, isTruthyValue(foundry.utils.getProperty(change, PLAYER_TOGGLE_PATH)));
  }
}

function getFlagUpdateValue(creationData) {
  if (Object.hasOwn(creationData, PLAYER_TOGGLE_PATH)) return creationData[PLAYER_TOGGLE_PATH];
  if (!foundry.utils.hasProperty(creationData, PLAYER_TOGGLE_PATH)) return undefined;
  return foundry.utils.getProperty(creationData, PLAYER_TOGGLE_PATH);
}

export function addPlayerToggleField(app, html) {
  if (!game.user.isGM) return;

  const element = getHTMLElement(html);
  if (!element) return;

  const currentValue = app.document.getFlag(MODULE_ID, FLAGS.PLAYER_TOGGLE_ENABLED);
  const checked = currentValue === undefined ? getPlayerToggleDefault() : isTruthyValue(currentValue);
  const hidden = createPlayerToggleInput("hidden", false);
  const checkbox = createPlayerToggleInput("checkbox", true, checked);
  const group = foundry.applications.fields.createFormGroup({
    input: checkbox,
    label: `${MODULE_ID}.ambientLightConfig.playerToggleEnabled.label`,
    hint: `${MODULE_ID}.ambientLightConfig.playerToggleEnabled.hint`,
    localize: true
  });

  group.prepend(hidden);
  insertPlayerToggleGroup(element, group);
  app.setPosition?.();
}

function createPlayerToggleInput(type, value, checked = false) {
  const input = document.createElement("input");
  input.type = type;
  input.name = PLAYER_TOGGLE_PATH;
  input.value = String(value);
  input.dataset.dtype = "Boolean";
  if (type === "checkbox") input.checked = checked;
  return input;
}

function insertPlayerToggleGroup(element, group) {
  const nameRow = element.querySelector('[name="name"]')?.closest(".form-group");
  if (nameRow) {
    nameRow.after(group);
    return;
  }

  const target = element.querySelector("form .tab[data-tab='basic']")
    ?? element.querySelector("form .tab.active")
    ?? element.querySelector("form .tab")
    ?? element.querySelector("form")
    ?? element;
  target.append(group);
}

let switchLayer;
let gmCanvasClickHandler;
let pendingRefresh = null;

export function scheduleLightSwitchRefresh() {
  if (pendingRefresh !== null) return;

  pendingRefresh = setTimeout(() => {
    pendingRefresh = null;
    refreshLightSwitches();
  }, 0);
}

export function refreshLightSwitches() {
  if (!globalThis.canvas?.ready || !globalThis.PIXI) {
    debugLog("refresh skipped", { canvasReady: globalThis.canvas?.ready, hasPixi: Boolean(globalThis.PIXI) });
    return;
  }

  const layer = prepareSwitchLayer();
  installGMCanvasClickHandler();
  if (isLightingControlsActive()) {
    debugLog("refresh skipped for lighting controls");
    return;
  }
  if (game.user.isGM && !shouldShowForGM()) {
    debugLog("refresh skipped for GM");
    return;
  }

  let rendered = 0;
  for (const placeable of canvas.lighting?.placeables ?? []) {
    if (!shouldShowSwitch(placeable)) continue;
    layer.addChild(createSwitchButton(placeable.document));
    rendered += 1;
  }

  debugLog("switches refreshed", { placeables: canvas.lighting?.placeables?.length ?? 0, rendered });
}

function prepareSwitchLayer() {
  ensureSwitchLayer();
  switchLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
  return switchLayer;
}

function ensureSwitchLayer() {
  if (switchLayer && !switchLayer.destroyed) return;

  switchLayer = new PIXI.Container();
  switchLayer.name = SWITCH_LAYER_NAME;
  switchLayer.eventMode = "passive";
  switchLayer.interactiveChildren = true;
  switchLayer.sortableChildren = true;
  switchLayer.zIndex = 10_000;
  canvas.stage.sortableChildren = true;
  canvas.stage.addChild(switchLayer);
}

export function shouldShowSwitch(placeable) {
  const light = placeable?.document;
  if (!light || isLightingControlsActive()) return false;
  if (light.hidden && !isLightOff(light)) return false;
  if (!isToggleAllowed(light)) return false;
  if (game.user.isGM) return shouldShowForGM();
  return canPlayerSeeLight(placeable);
}

export function canPlayerSeeLight(placeable) {
  const light = placeable.document;
  if (!isLightOff(light) && (placeable.visible === false || placeable.renderable === false)) return false;

  const visibility = canvas.visibility ?? canvas.effects?.visibility;
  if (typeof visibility?.testVisibility !== "function") return true;

  const options = isLightOff(light) ? { tolerance: 0 } : { object: placeable, tolerance: 0 };
  return visibility.testVisibility({ x: light.x, y: light.y }, options) === true;
}

export function isLightingControlsActive() {
  return canvas?.lighting?.active === true || ui?.controls?.control?.name === "lighting";
}

function createSwitchButton(light) {
  const button = new PIXI.Container();
  const off = isLightOff(light);

  button.x = light.x;
  button.y = light.y;
  button.eventMode = "static";
  button.interactive = true;
  button.cursor = "pointer";
  button.hitArea = new PIXI.Rectangle(-HIT_SIZE / 2, -HIT_SIZE / 2, HIT_SIZE, HIT_SIZE);
  button.scale.set(1 / (canvas.stage?.scale?.x || 1));
  button.addChild(createButtonBackground(off));
  button.addChild(createButtonIcon(off));
  button.on("pointerdown", (event) => handleSwitchPointerDown(event, light));

  return button;
}

function createButtonBackground(off) {
  const graphics = new PIXI.Graphics();
  graphics
    .lineStyle(2, off ? 0xb8b8b8 : 0xffd76a, 0.95)
    .beginFill(off ? 0x2c2c2c : 0x1e1e1e, 0.88)
    .drawCircle(0, 0, SWITCH_SIZE / 2)
    .endFill();
  return graphics;
}

function createButtonIcon(off) {
  const icon = new PIXI.Graphics();
  const glass = off ? 0x777777 : 0xffd76a;
  const stroke = off ? 0xb8b8b8 : 0xfff0a3;

  icon
    .lineStyle(1.5, stroke, 0.95)
    .beginFill(glass, off ? 0.42 : 0.95)
    .drawCircle(0, -4, 6)
    .endFill();
  icon
    .lineStyle(1, off ? 0xa0a0a0 : 0xffd76a, 0.85)
    .beginFill(off ? 0x555555 : 0x8d7840, 0.95)
    .drawPolygon([-4, 2, 4, 2, 3, 8, -3, 8])
    .endFill();
  if (!off) icon.lineStyle(1.25, 0x7a5a00, 0.72).moveTo(-3, -4).lineTo(-1, -1).lineTo(1, -4).lineTo(3, -1);

  return icon;
}

function handleSwitchPointerDown(event, light) {
  event.preventDefault?.();
  event.stopPropagation();
  debugNotify("PIXI button clicked", { lightId: light.id });
  requestLightToggle(light).catch((error) => {
    reportToggleError("Failed to toggle light from PIXI button", error);
  });
}

function installGMCanvasClickHandler() {
  const canvasElement = canvas.app?.canvas ?? canvas.app?.view ?? document.querySelector("#board canvas") ?? document.querySelector("canvas");
  if (!canvasElement || gmCanvasClickHandler) return;

  gmCanvasClickHandler = (event) => {
    if (!game.user.isGM || !shouldShowForGM() || isLightingControlsActive()) return;

    const light = getLightAtClientPoint(event.clientX, event.clientY);
    if (!light) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    debugNotify("GM canvas click matched light", { lightId: light.id });
    requestLightToggle(light).catch((error) => {
      reportToggleError("Failed to toggle light from GM canvas click", error);
    });
  };

  canvasElement.addEventListener("pointerdown", gmCanvasClickHandler, true);
}

function getLightAtClientPoint(clientX, clientY) {
  let closestLight = null;
  let closestDistance = Infinity;

  for (const placeable of canvas.lighting?.placeables ?? []) {
    if (!shouldShowSwitch(placeable)) continue;

    const point = getClientPosition(placeable.document);
    const distance = Math.hypot(clientX - point.x, clientY - point.y);
    if (distance > HIT_SIZE / 2 || distance >= closestDistance) continue;

    closestLight = placeable.document;
    closestDistance = distance;
  }

  return closestLight;
}

function getClientPosition(light) {
  const canvasElement = canvas.app?.canvas ?? canvas.app?.view;
  const rect = canvasElement?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
  const point = canvas.stage.worldTransform.apply({ x: light.x, y: light.y });
  return { x: rect.left + point.x, y: rect.top + point.y };
}
