import {
  CANVAS_RENDER,
  COLORS,
  DOM,
  FLAGS,
  FLAG_PATHS,
  FOUNDRY,
  HIT_SIZE,
  MODULE_ID,
  QUERY_NAMES,
  QUERY_TIMEOUT_MS,
  SWITCH_ICON,
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
    const queryResult = await gm.query(QUERY_NAMES.TOGGLE_LIGHT, payload, { timeout: QUERY_TIMEOUT_MS });
    debugLog("GM light query result", { gmId: gm.id, result: queryResult });
    return queryResult;
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
  await scene.updateEmbeddedDocuments(FOUNDRY.AMBIENT_LIGHT_TYPE, [{ _id: light.id, ...update }]);
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
  return light?.canUserModify?.(game.user, FOUNDRY.UPDATE_PERMISSION) === true;
}

function getLightRequestIds(light) {
  return {
    sceneId: light?.scene?.id ?? canvas.scene?.id,
    lightId: light?.id
  };
}

function getSceneLight(sceneId, lightId) {
  const scene = game.scenes.get(sceneId);
  const light = scene?.getEmbeddedDocument?.(FOUNDRY.AMBIENT_LIGHT_TYPE, lightId)
    ?? scene?.lights?.get?.(lightId)
    ?? scene?.collections?.get(FOUNDRY.AMBIENT_LIGHT_TYPE)?.get(lightId)
    ?? null;

  return {
    scene,
    light
  };
}

export function setDefaultPlayerToggleFlag(document, creationData) {
  const currentValue = getFlagUpdateValue(creationData);
  const value = currentValue === undefined ? getPlayerToggleDefault() : isTruthyValue(currentValue);

  document.updateSource?.({ [FLAG_PATHS.PLAYER_TOGGLE_ENABLED]: value });
  foundry.utils.setProperty(creationData, FLAG_PATHS.PLAYER_TOGGLE_ENABLED, value);
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

  group.prepend(inputs.hidden);
  insertPlayerToggleGroup(element, group);
  app.setPosition?.();
}

function createBooleanInputs(checked) {
  return {
    hidden: createPlayerToggleInput(DOM.INPUT_TYPES.HIDDEN, false),
    checkbox: createPlayerToggleInput(DOM.INPUT_TYPES.CHECKBOX, true, checked)
  };
}

function createPlayerToggleInput(type, value, checked = false) {
  const input = document.createElement("input");
  input.type = type;
  input.name = FLAG_PATHS.PLAYER_TOGGLE_ENABLED;
  input.value = String(value);
  input.dataset.dtype = DOM.BOOLEAN_DTYPE;
  if (type === DOM.INPUT_TYPES.CHECKBOX) input.checked = checked;
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
  group.className = DOM.FORM_GROUP_CLASS;

  const label = document.createElement("label");
  label.textContent = game.i18n.localize(`${MODULE_ID}.ambientLightConfig.playerToggleEnabled.label`);

  const hint = document.createElement("p");
  hint.className = DOM.HINT_CLASS;
  hint.textContent = game.i18n.localize(`${MODULE_ID}.ambientLightConfig.playerToggleEnabled.hint`);

  group.append(label, input, hint);
  return group;
}

function findFieldTarget(element) {
  return element.querySelector(DOM.BASIC_TAB_SELECTOR)
    ?? element.querySelector(DOM.ACTIVE_TAB_SELECTOR)
    ?? element.querySelector(DOM.TAB_SELECTOR)
    ?? element.querySelector(DOM.FORM_SELECTOR)
    ?? element;
}

function insertPlayerToggleGroup(element, group) {
  const nameRow = element.querySelector(DOM.NAME_INPUT_SELECTOR)?.closest(`.${DOM.FORM_GROUP_CLASS}`);
  if (nameRow) {
    nameRow.after(group);
  } else {
    findFieldTarget(element).append(group);
  }
}

function getDocumentPlayerToggleValue(document) {
  const value = document.getFlag(MODULE_ID, FLAGS.PLAYER_TOGGLE_ENABLED);
  if (value === undefined) return undefined;
  return isTruthyValue(value);
}

function getFlagUpdateValue(creationData) {
  if (Object.hasOwn(creationData, FLAG_PATHS.PLAYER_TOGGLE_ENABLED)) return creationData[FLAG_PATHS.PLAYER_TOGGLE_ENABLED];
  if (!foundry.utils.hasProperty(creationData, FLAG_PATHS.PLAYER_TOGGLE_ENABLED)) return undefined;
  return foundry.utils.getProperty(creationData, FLAG_PATHS.PLAYER_TOGGLE_ENABLED);
}

export function createButtonBackground(off) {
  const graphics = new PIXI.Graphics();
  const fill = off ? COLORS.offBackground : COLORS.onBackground;
  const stroke = off ? COLORS.offStroke : COLORS.onGold;

  drawCircle(graphics, {
    x: 0,
    y: 0,
    radius: SWITCH_SIZE / 2,
    fill,
    alpha: SWITCH_ICON.backgroundAlpha,
    stroke,
    strokeWidth: SWITCH_ICON.backgroundStrokeWidth
  });
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
    glassAlpha: off ? SWITCH_ICON.offGlassAlpha : SWITCH_ICON.onGlassAlpha,
    glassStroke: off ? COLORS.offStroke : COLORS.onStroke,
    base: off ? COLORS.offBase : COLORS.onBase,
    baseStroke: off ? SWITCH_ICON.offBaseStroke : COLORS.onGold
  };
}

function drawGlow(icon, off) {
  if (off) return;
  drawCircle(icon, { ...SWITCH_ICON.glow.outer, fill: COLORS.onGold });
  drawCircle(icon, { ...SWITCH_ICON.glow.inner, fill: COLORS.onGlow });
}

function drawBulb(icon, palette) {
  drawEllipse(icon, {
    ...SWITCH_ICON.bulb.glass,
    fill: palette.glass,
    alpha: palette.glassAlpha,
    stroke: palette.glassStroke
  });
  drawPolygon(icon, {
    ...SWITCH_ICON.bulb.neck,
    fill: palette.glass,
    alpha: palette.glassAlpha,
    stroke: palette.glassStroke
  });
}

function drawFilament(icon, off) {
  if (off) return;
  drawLine(icon, { ...SWITCH_ICON.filament.line, color: COLORS.filament });
  drawCircle(icon, { ...SWITCH_ICON.filament.highlight, fill: COLORS.white });
}

function drawBase(icon, palette, off) {
  drawBaseTop(icon, palette);
  drawLine(icon, {
    ...SWITCH_ICON.base.separator,
    color: off ? COLORS.offStroke : SWITCH_ICON.base.separator.color
  });
  drawBaseBottom(icon, palette);
}

function drawBaseTop(icon, palette) {
  drawRoundedRect(icon, {
    ...SWITCH_ICON.base.top,
    fill: palette.base,
    stroke: palette.baseStroke
  });
}

function drawBaseBottom(icon, palette) {
  drawRoundedRect(icon, {
    ...SWITCH_ICON.base.bottom,
    fill: palette.base,
    stroke: palette.baseStroke
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
  }, CANVAS_RENDER.REFRESH_DELAY_MS);
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
  switchLayer.eventMode = DOM.PASSIVE_EVENT_MODE;
  switchLayer.interactiveChildren = true;
  switchLayer.sortableChildren = true;
  switchLayer.zIndex = CANVAS_RENDER.SWITCH_LAYER_Z_INDEX;

  const parent = canvas.stage;
  parent.sortableChildren = true;
  parent.addChild(switchLayer);
}

export function shouldShowSwitch(placeable) {
  const visibility = getSwitchVisibilityReason(placeable);
  debugLog("switch visibility checked", visibility);
  return visibility.visible;
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
  if (isLightOff(placeable.document)) return { tolerance: CANVAS_RENDER.VISIBILITY_TOLERANCE };
  return { object: placeable, tolerance: CANVAS_RENDER.VISIBILITY_TOLERANCE };
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
  button.on(DOM.POINTER_DOWN_EVENT, (event) => handleSwitchPointerDown(event, light));

  return button;
}

function configureSwitchButton(button, light) {
  button.x = light.x;
  button.y = light.y;
  button.eventMode = DOM.STATIC_EVENT_MODE;
  button.interactive = true;
  button.cursor = DOM.POINTER_CURSOR;
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

  canvasElement.addEventListener(DOM.POINTER_DOWN_EVENT, canvasClickHandler, true);
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
    ?? document.querySelector(DOM.BOARD_CANVAS_SELECTOR)
    ?? document.querySelector(DOM.CANVAS_SELECTOR);
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
  const scale = canvas.stage?.scale?.x || CANVAS_RENDER.DEFAULT_SCALE;
  return 1 / scale;
}
