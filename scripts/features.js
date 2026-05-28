import {
  COLORS,
  FLAGS,
  FLAG_PATHS,
  HIT_SIZE,
  MODULE_ID,
  QUERY_NAMES,
  QUERY_TIMEOUT_MS,
  SWITCH_LAYER_NAME,
  SWITCH_SIZE
} from "./config.js";
import {
  cloneConfig,
  drawCircle,
  drawEllipse,
  drawLine,
  drawPolygon,
  drawRoundedRect,
  getHTMLElement,
  isTruthyValue
} from "./utils.js";
import { debugLog, debugNotify, getQueryRejectDebug, reportToggleError } from "./debug.js";
import { getPlayerToggleDefault, shouldShowForGM } from "./settings.js";

export { FLAGS, MODULE_ID, QUERY_NAMES, SETTINGS } from "./config.js";
export { cloneConfig, isTruthyValue } from "./utils.js";
export { getPlayerToggleDefault, shouldShowForGM } from "./settings.js";

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
    [FLAG_PATHS.IS_OFF]: true,
    [FLAG_PATHS.RESTORE_CONFIG]: config
  };
  debugLog("build turn off update", { lightId: light?.id, update });
  return update;
}

export function buildTurnOnUpdate(light) {
  const restoreConfig = light?.getFlag?.(MODULE_ID, FLAGS.RESTORE_CONFIG);
  const update = {
    hidden: false,
    [FLAG_PATHS.IS_OFF]: false,
    [FLAG_PATHS.DELETE_RESTORE_CONFIG]: null
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

export function registerSocket() {
  CONFIG.queries[QUERY_NAMES.TOGGLE_LIGHT] = handleToggleLightQuery;
  debugLog("query registered", {
    query: QUERY_NAMES.TOGGLE_LIGHT,
    userId: game.user.id,
    isGM: game.user.isGM
  });
}

export async function requestLightToggle(light) {
  const ids = getLightRequestIds(light);

  if (!ids.sceneId || !ids.lightId) {
    debugNotify("light request missing ids", ids);
    return { ok: false, reason: "missing-ids" };
  }

  if (canUpdateLight(light)) return applyDirectToggle(light, ids.lightId);
  return queryActiveGM(ids);
}

async function queryActiveGM(payload) {
  const gm = getActiveGM();
  if (!gm) {
    debugNotify("no active GM for light query", payload);
    return { ok: false, reason: "no-active-gm" };
  }

  debugLog("query GM light toggle", { gmId: gm.id, payload });
  return sendToggleQuery(gm, payload);
}

async function sendToggleQuery(gm, payload) {
  try {
    const result = await gm.query(QUERY_NAMES.TOGGLE_LIGHT, payload, { timeout: QUERY_TIMEOUT_MS });
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

async function applyDirectToggle(light, lightId) {
  const update = buildValidatedToggleUpdate(light, game.user, { allowGM: true });
  debugLog("direct update path", { lightId, update });
  if (!update) return { ok: false, reason: "rejected" };
  await light.update(update);
  return { ok: true, direct: true };
}

export async function handleToggleLightQuery(payload, { user } = {}) {
  logQueryReceived(payload, user);
  if (!game.user.isGM) return { ok: false, reason: "not-gm" };

  const { scene, light } = getSceneLight(payload?.sceneId, payload?.lightId);
  const update = buildValidatedToggleUpdate(light, user);

  if (!scene || !light || !update) {
    debugNotify("toggle light query rejected", getQueryRejectDebug(payload, scene, light, user));
    return { ok: false, reason: "rejected" };
  }

  await applyGMUpdate(scene, light, update);
  return { ok: true };
}

function logQueryReceived(payload, user) {
  debugLog("toggle light query received", {
    payload,
    requesterId: user?.id,
    receiverId: game.user.id,
    isGM: game.user.isGM
  });
}

async function applyGMUpdate(scene, light, update) {
  debugNotify("GM applying light update", { sceneId: scene.id, lightId: light.id, update });
  await scene.updateEmbeddedDocuments("AmbientLight", [{ _id: light.id, ...update }]);
}

export function buildValidatedToggleUpdate(light, user, { allowGM = false } = {}) {
  if (!light || !user) return null;
  if (user.isGM && !allowGM) return null;
  return buildToggleUpdate(light);
}

function getActiveGM() {
  return game.users.find((user) => user.active && user.isGM) ?? null;
}

function canUpdateLight(light) {
  return light?.canUserModify?.(game.user, "update") === true;
}

function getLightRequestIds(light) {
  return {
    sceneId: light?.scene?.id ?? canvas.scene?.id,
    lightId: light?.id
  };
}

function getSceneLight(sceneId, lightId) {
  const scene = game.scenes.get(sceneId);
  const light = scene?.getEmbeddedDocument?.("AmbientLight", lightId)
    ?? scene?.lights?.get?.(lightId)
    ?? scene?.collections?.get("AmbientLight")?.get(lightId)
    ?? null;

  return {
    scene,
    light
  };
}

export function setDefaultPlayerToggleFlag(document, data) {
  const currentValue = getFlagUpdateValue(data);
  const value = currentValue === undefined ? getPlayerToggleDefault() : isTruthyValue(currentValue);

  document.updateSource?.({ [FLAG_PATHS.PLAYER_TOGGLE_ENABLED]: value });
  foundry.utils.setProperty(data, FLAG_PATHS.PLAYER_TOGGLE_ENABLED, value);
}

export function normalizePlayerToggleFlag(document, change) {
  normalizeFlattenedFlag(change);
  normalizeNestedFlag(change);
}

function normalizeFlattenedFlag(change) {
  if (Object.hasOwn(change, FLAG_PATHS.PLAYER_TOGGLE_ENABLED)) {
    change[FLAG_PATHS.PLAYER_TOGGLE_ENABLED] = isTruthyValue(change[FLAG_PATHS.PLAYER_TOGGLE_ENABLED]);
  }
}

function normalizeNestedFlag(change) {
  if (foundry.utils.hasProperty(change, FLAG_PATHS.PLAYER_TOGGLE_ENABLED)) {
    foundry.utils.setProperty(
      change,
      FLAG_PATHS.PLAYER_TOGGLE_ENABLED,
      isTruthyValue(foundry.utils.getProperty(change, FLAG_PATHS.PLAYER_TOGGLE_ENABLED))
    );
  }
}

export function addPlayerToggleField(app, html) {
  if (!game.user.isGM) return;

  const element = getHTMLElement(html);
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

function createBooleanInputs(checked) {
  return {
    hidden: createPlayerToggleInput("hidden", false),
    checkbox: createPlayerToggleInput("checkbox", true, checked)
  };
}

function createPlayerToggleInput(type, value, checked = false) {
  const input = document.createElement("input");
  input.type = type;
  input.name = FLAG_PATHS.PLAYER_TOGGLE_ENABLED;
  input.value = String(value);
  input.dataset.dtype = "Boolean";
  if (type === "checkbox") input.checked = checked;
  return input;
}

function createFormGroup(input) {
  if (foundry.applications?.fields?.createFormGroup) return createFoundryFormGroup(input);
  return createFallbackFormGroup(input);
}

function createFoundryFormGroup(input) {
  return foundry.applications.fields.createFormGroup({
    input,
    label: `${MODULE_ID}.ambientLightConfig.playerToggleEnabled.label`,
    hint: `${MODULE_ID}.ambientLightConfig.playerToggleEnabled.hint`,
    localize: true
  });
}

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
  return isTruthyValue(value);
}

function getFlagUpdateValue(data) {
  if (Object.hasOwn(data, FLAG_PATHS.PLAYER_TOGGLE_ENABLED)) return data[FLAG_PATHS.PLAYER_TOGGLE_ENABLED];
  if (!foundry.utils.hasProperty(data, FLAG_PATHS.PLAYER_TOGGLE_ENABLED)) return undefined;
  return foundry.utils.getProperty(data, FLAG_PATHS.PLAYER_TOGGLE_ENABLED);
}

export function createButtonBackground(off) {
  const graphics = new PIXI.Graphics();
  const fill = off ? COLORS.offBackground : COLORS.onBackground;
  const stroke = off ? COLORS.offStroke : COLORS.onGold;

  drawCircle(graphics, { x: 0, y: 0, radius: SWITCH_SIZE / 2, fill, alpha: 0.88, stroke, strokeWidth: 2 });
  return graphics;
}

export function createButtonIcon(off) {
  const icon = new PIXI.Graphics();
  const palette = getPalette(off);

  drawGlow(icon, off);
  drawBulb(icon, palette);
  drawFilament(icon, off);
  drawBase(icon, palette, off);

  return icon;
}

function getPalette(off) {
  return {
    glass: off ? COLORS.offGlass : COLORS.onGold,
    glassAlpha: off ? 0.42 : 0.95,
    glassStroke: off ? COLORS.offStroke : COLORS.onStroke,
    base: off ? COLORS.offBase : COLORS.onBase,
    baseStroke: off ? 0xa0a0a0 : COLORS.onGold
  };
}

function drawGlow(icon, off) {
  if (off) return;
  drawCircle(icon, { x: 0, y: -3, radius: 11, fill: COLORS.onGold, alpha: 0.16 });
  drawCircle(icon, { x: 0, y: -3, radius: 7, fill: COLORS.onGlow, alpha: 0.2 });
}

function drawBulb(icon, palette) {
  drawEllipse(icon, {
    x: 0,
    y: -5,
    width: 7,
    height: 8,
    fill: palette.glass,
    alpha: palette.glassAlpha,
    stroke: palette.glassStroke,
    strokeWidth: 1.6
  });
  drawPolygon(icon, {
    points: [-4, 2, 4, 2, 3, 6, -3, 6],
    fill: palette.glass,
    alpha: palette.glassAlpha,
    stroke: palette.glassStroke,
    strokeWidth: 1.2
  });
}

function drawFilament(icon, off) {
  if (off) return;
  drawLine(icon, { points: [-3, -4, -1, -1, 1, -4, 3, -1], color: COLORS.filament, width: 1.25, alpha: 0.72 });
  drawCircle(icon, { x: -2.6, y: -8.2, radius: 1.5, fill: COLORS.white, alpha: 0.58 });
}

function drawBase(icon, palette, off) {
  drawBaseTop(icon, palette);
  drawLine(icon, { points: [-3.4, 6.5, 3.4, 6.5], color: off ? COLORS.offStroke : 0xffef9b, width: 0.9, alpha: 0.72 });
  drawBaseBottom(icon, palette);
}

function drawBaseTop(icon, palette) {
  drawRoundedRect(icon, {
    x: -4.8,
    y: 5,
    width: 9.6,
    height: 4.2,
    radius: 1.2,
    fill: palette.base,
    alpha: 0.95,
    stroke: palette.baseStroke,
    strokeWidth: 1.1
  });
}

function drawBaseBottom(icon, palette) {
  drawRoundedRect(icon, {
    x: -3.4,
    y: 9,
    width: 6.8,
    height: 2.3,
    radius: 0.8,
    fill: palette.base,
    alpha: 0.9,
    stroke: palette.baseStroke,
    strokeWidth: 0.8
  });
}

let switchLayer;
let canvasClickHandler;
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
  installCanvasClickHandler();

  if (shouldSkipRefresh()) return;
  renderSwitches(layer);
}

function renderSwitches(layer) {
  let rendered = 0;

  for (const placeable of canvas.lighting?.placeables ?? []) {
    if (!shouldShowSwitch(placeable)) continue;
    layer.addChild(createSwitchButton(placeable.document));
    rendered += 1;
  }

  debugLog("switches refreshed", {
    placeables: canvas.lighting?.placeables?.length ?? 0,
    rendered
  });
}

function prepareSwitchLayer() {
  ensureSwitchLayer();
  switchLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
  return switchLayer;
}

function shouldSkipRefresh() {
  if (isLightingControlsActive()) {
    debugLog("refresh skipped for lighting controls");
    return true;
  }

  if (game.user.isGM && !shouldShowForGM()) {
    debugLog("refresh skipped for GM");
    return true;
  }

  return false;
}

function ensureSwitchLayer() {
  if (switchLayer && !switchLayer.destroyed) return;

  switchLayer = new PIXI.Container();
  switchLayer.name = SWITCH_LAYER_NAME;
  switchLayer.eventMode = "passive";
  switchLayer.interactiveChildren = true;
  switchLayer.sortableChildren = true;
  switchLayer.zIndex = 10_000;

  const parent = canvas.stage;
  parent.sortableChildren = true;
  parent.addChild(switchLayer);
}

export function shouldShowSwitch(placeable) {
  const result = getSwitchVisibilityReason(placeable);
  debugLog("switch visibility checked", result);
  return result.visible;
}

export function getSwitchVisibilityReason(placeable) {
  const light = placeable?.document;
  const showAsGM = game.user.isGM && shouldShowForGM();

  if (!light) return { visible: false, reason: "missing-light" };
  if (isLightingControlsActive()) return { visible: false, reason: "lighting-controls-active", lightId: light.id };
  if (light.hidden && !isLightOff(light)) return { visible: false, reason: "hidden", lightId: light.id };
  if (!isToggleAllowed(light)) return { visible: false, reason: "toggle-disabled", lightId: light.id };
  if (showAsGM) return { visible: true, reason: "visible-for-gm", lightId: light.id };
  if (!canPlayerSeeLight(placeable)) return { visible: false, reason: "not-visible-to-player", lightId: light.id };
  return { visible: true, reason: "visible", lightId: light.id };
}

export function canPlayerSeeLight(placeable) {
  if (isInvisibleActiveLight(placeable)) return false;
  const visibility = canvas.visibility ?? canvas.effects?.visibility;

  if (typeof visibility?.testVisibility === "function") {
    return visibility.testVisibility(getLightPoint(placeable.document), getVisibilityOptions(placeable)) === true;
  }

  return true;
}

function isInvisibleActiveLight(placeable) {
  return !isLightOff(placeable.document) && (placeable.visible === false || placeable.renderable === false);
}

function getVisibilityOptions(placeable) {
  if (isLightOff(placeable.document)) return { tolerance: 0 };
  return { object: placeable, tolerance: 0 };
}

function getLightPoint(light) {
  return {
    x: light.x,
    y: light.y
  };
}

export function isLightingControlsActive() {
  return canvas?.lighting?.active === true || ui?.controls?.control?.name === "lighting";
}

function createSwitchButton(light) {
  const button = new PIXI.Container();
  const off = isLightOff(light);

  configureSwitchButton(button, light);
  button.addChild(createButtonBackground(off));
  button.addChild(createButtonIcon(off));
  button.on("pointerdown", (event) => handleSwitchPointerDown(event, light));

  return button;
}

function configureSwitchButton(button, light) {
  button.x = light.x;
  button.y = light.y;
  button.eventMode = "static";
  button.interactive = true;
  button.cursor = "pointer";
  button.hitArea = new PIXI.Rectangle(-HIT_SIZE / 2, -HIT_SIZE / 2, HIT_SIZE, HIT_SIZE);
  button.scale.set(getInverseCanvasScale());
}

function handleSwitchPointerDown(event, light) {
  event.preventDefault?.();
  event.stopPropagation();
  debugNotify("PIXI button clicked", { lightId: light.id });
  requestLightToggle(light).catch((error) => {
    reportToggleError("Failed to toggle light from PIXI button", error);
  });
}

function installCanvasClickHandler() {
  const canvasElement = getCanvasElement();
  if (!canvasElement || canvasClickHandler) return;

  canvasClickHandler = (event) => {
    if (isLightingControlsActive()) return;
    if (game.user.isGM && !shouldShowForGM()) return;

    handleCanvasPointerDown(event);
  };

  canvasElement.addEventListener("pointerdown", canvasClickHandler, true);
}

function handleCanvasPointerDown(event) {
  const light = getLightAtClientPoint(event.clientX, event.clientY);
  debugLog("canvas pointerdown", {
    clientX: event.clientX,
    clientY: event.clientY,
    lightId: light?.id
  });

  if (!light) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  debugNotify("canvas click matched light", { lightId: light.id });
  requestLightToggle(light).catch((error) => {
    reportToggleError("Failed to toggle light", error);
  });
}

function getCanvasElement() {
  return canvas.app?.canvas
    ?? canvas.app?.view
    ?? document.querySelector("#board canvas")
    ?? document.querySelector("canvas");
}

function getLightAtClientPoint(clientX, clientY) {
  let closestLight = null;
  let closestDistance = Infinity;

  for (const placeable of canvas.lighting?.placeables ?? []) {
    if (!shouldShowSwitch(placeable)) continue;

    const distance = getClickDistance(placeable, clientX, clientY);
    if (!isCloserHit(distance, closestDistance)) continue;

    closestLight = placeable.document;
    closestDistance = distance;
  }

  return closestLight;
}

function getClickDistance(placeable, clientX, clientY) {
  const point = getClientPosition(placeable.document);
  const distance = Math.hypot(clientX - point.x, clientY - point.y);

  debugLog("candidate light distance", {
    lightId: placeable.document.id,
    clientX,
    clientY,
    point,
    distance,
    hitRadius: HIT_SIZE / 2
  });

  return distance;
}

function isCloserHit(distance, closestDistance) {
  return distance <= HIT_SIZE / 2 && distance < closestDistance;
}

function getClientPosition(light) {
  const canvasElement = getCanvasElement();
  const rect = canvasElement?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
  const point = canvas.stage.worldTransform.apply({
    x: light.x,
    y: light.y
  });

  return {
    x: rect.left + point.x,
    y: rect.top + point.y
  };
}

function getInverseCanvasScale() {
  const scale = canvas.stage?.scale?.x || 1;
  return 1 / scale;
}
