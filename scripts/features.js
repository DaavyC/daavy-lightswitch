import { FLAGS, MODULE_ID, TOGGLE_QUERY } from "./config.js";
import { getHTMLElement, isPointWithinGridDistance, isTruthyValue } from "./utils.js";
import {
  doesInteractionDistanceAffectGM,
  getInteractionDistance,
  getPlayerToggleDefault,
  isInteractionDistanceLimited,
  shouldShowForGM
} from "./settings.js";

const AMBIENT_LIGHT_TYPE = "AmbientLight";
const PLAYER_TOGGLE_PATH = `flags.${MODULE_ID}.${FLAGS.PLAYER_TOGGLE_ENABLED}`;
const IS_OFF_PATH = `flags.${MODULE_ID}.${FLAGS.IS_OFF}`;
const RESTORE_CONFIG_PATH = `flags.${MODULE_ID}.${FLAGS.RESTORE_CONFIG}`;
const DELETE_RESTORE_CONFIG_PATH = `flags.${MODULE_ID}.-=${FLAGS.RESTORE_CONFIG}`;
const SWITCH_LAYER_NAME = "daavyLightswitchLayer";
const SWITCH_SIZE = 28;
const HIT_SIZE = 42;

function isToggleAllowed(light) {
  return isTruthyValue(light?.getFlag?.(MODULE_ID, FLAGS.PLAYER_TOGGLE_ENABLED));
}

function isLightOff(light) {
  return light?.getFlag?.(MODULE_ID, FLAGS.IS_OFF) === true;
}

function buildTurnOffUpdate(light) {
  return {
    hidden: true,
    [IS_OFF_PATH]: true,
    [RESTORE_CONFIG_PATH]: structuredClone(light?._source?.config ?? {})
  };
}

function buildTurnOnUpdate(light) {
  const restoreConfig = light?.getFlag?.(MODULE_ID, FLAGS.RESTORE_CONFIG);
  const update = {
    hidden: false,
    [IS_OFF_PATH]: false,
    [DELETE_RESTORE_CONFIG_PATH]: null
  };

  if (restoreConfig && typeof restoreConfig === "object") update.config = structuredClone(restoreConfig);
  return update;
}

function buildToggleUpdate(light) {
  if (!isToggleAllowed(light)) return null;
  return isLightOff(light) ? buildTurnOnUpdate(light) : buildTurnOffUpdate(light);
}

export function registerSocket() {
  CONFIG.queries[TOGGLE_QUERY] = handleToggleLightQuery;
}

async function requestLightToggle(light) {
  const ids = {
    sceneId: light?.scene?.id ?? canvas.scene?.id,
    lightId: light?.id,
    tokenIds: getControlledTokenIds()
  };

  if (!ids.sceneId || !ids.lightId) return { ok: false, reason: "missing-ids" };

  if (light?.canUserModify?.(game.user, "update") === true) {
    const update = buildValidatedToggleUpdate(light, game.user, { allowGM: true, tokenIds: ids.tokenIds });
    if (!update) return { ok: false, reason: "rejected" };
    await light.update(update);
    return { ok: true, direct: true };
  }

  const gm = game.users.find((user) => user.active && user.isGM);
  if (!gm) return { ok: false, reason: "no-active-gm" };

  try {
    return await gm.query(TOGGLE_QUERY, ids, { timeout: 5000 });
  } catch {
    return { ok: false, reason: "query-failed" };
  }
}

async function handleToggleLightQuery(payload, { user } = {}) {
  if (!game.user.isGM) return { ok: false, reason: "not-gm" };

  const scene = game.scenes.get(payload?.sceneId);
  const light = scene?.getEmbeddedDocument(AMBIENT_LIGHT_TYPE, payload?.lightId);
  const update = buildValidatedToggleUpdate(light, user, { tokenIds: payload?.tokenIds });

  if (!scene || !light || !update) return { ok: false, reason: "rejected" };

  await scene.updateEmbeddedDocuments(AMBIENT_LIGHT_TYPE, [{ _id: light.id, ...update }]);
  return { ok: true };
}

function buildValidatedToggleUpdate(light, user, { allowGM = false, tokenIds = [] } = {}) {
  if (!light || !user) return null;
  if (user.isGM && !allowGM) return null;
  if (!isInteractionInRange(light, user, tokenIds)) return null;
  return buildToggleUpdate(light);
}

function isInteractionInRange(light, user, tokenIds) {
  if (!isInteractionDistanceLimited()) return true;
  if (user.isGM && !doesInteractionDistanceAffectGM()) return true;

  const scene = light.parent;
  const gridSize = Number(scene?.grid?.size);
  const controlledIds = new Set(Array.isArray(tokenIds) ? tokenIds : []);
  if (!scene || !gridSize) return false;
  if (!controlledIds.size) return user.isGM;

  return [...scene.tokens].some((token) => {
    if (!controlledIds.has(token.id)) return false;
    if (!token.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) return false;

    return isPointWithinGridDistance(
      { x: light.x, y: light.y },
      {
        x: token.x,
        y: token.y,
        width: token.width * gridSize,
        height: token.height * gridSize
      },
      gridSize,
      getInteractionDistance()
    );
  });
}

function getControlledTokenIds() {
  return (canvas.tokens?.controlled ?? []).map((token) => token.document.id);
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
  if (!globalThis.canvas?.ready || !globalThis.PIXI) return;

  ensureSwitchLayer();
  switchLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
  installGMCanvasClickHandler();
  if (isLightingControlsActive()) return;
  if (game.user.isGM && !shouldShowForGM()) return;

  for (const placeable of canvas.lighting?.placeables ?? []) {
    if (!shouldShowSwitch(placeable)) continue;
    switchLayer.addChild(createSwitchButton(placeable.document));
  }
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

function shouldShowSwitch(placeable) {
  const light = placeable?.document;
  if (!light || isLightingControlsActive()) return false;
  if (light.hidden && !isLightOff(light)) return false;
  if (!isToggleAllowed(light)) return false;
  if (!isInteractionInRange(light, game.user, getControlledTokenIds())) return false;
  if (game.user.isGM) return shouldShowForGM();
  return canPlayerSeeLight(placeable);
}

function canPlayerSeeLight(placeable) {
  const light = placeable.document;
  if (!isLightOff(light) && (placeable.visible === false || placeable.renderable === false)) return false;

  const visibility = canvas.visibility ?? canvas.effects?.visibility;
  if (typeof visibility?.testVisibility !== "function") return true;

  const options = isLightOff(light) ? { tolerance: 0 } : { object: placeable, tolerance: 0 };
  return visibility.testVisibility({ x: light.x, y: light.y }, options) === true;
}

function isLightingControlsActive() {
  return canvas?.lighting?.active === true || ui?.controls?.control?.name === "lighting";
}

function createSwitchButton(light) {
  const button = new PIXI.Container();
  const off = isLightOff(light);
  const graphics = new PIXI.Graphics();

  button.x = light.x;
  button.y = light.y;
  button.eventMode = "static";
  button.interactive = true;
  button.cursor = "pointer";
  button.hitArea = new PIXI.Rectangle(-HIT_SIZE / 2, -HIT_SIZE / 2, HIT_SIZE, HIT_SIZE);
  button.scale.set(1 / (canvas.stage?.scale?.x || 1));
  graphics
    .lineStyle(2, off ? 0xb8b8b8 : 0xffd76a, 0.95)
    .beginFill(off ? 0x2c2c2c : 0xffd76a, off ? 0.88 : 0.95)
    .drawCircle(0, 0, SWITCH_SIZE / 2)
    .endFill();
  button.addChild(graphics);
  button.on("pointerdown", (event) => handleSwitchPointerDown(event, light));

  return button;
}

function handleSwitchPointerDown(event, light) {
  event.preventDefault?.();
  event.stopPropagation();
  requestLightToggle(light).catch((error) => {
    console.error(`${MODULE_ID} | Failed to toggle light from PIXI button`, error);
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
    requestLightToggle(light).catch((error) => {
      console.error(`${MODULE_ID} | Failed to toggle light from GM canvas click`, error);
    });
  };

  canvasElement.addEventListener("pointerdown", gmCanvasClickHandler, true);
}

function getLightAtClientPoint(clientX, clientY) {
  let closestLight = null;
  let closestDistance = Infinity;
  const canvasElement = canvas.app?.canvas ?? canvas.app?.view;
  const rect = canvasElement?.getBoundingClientRect?.() ?? { left: 0, top: 0 };

  for (const placeable of canvas.lighting?.placeables ?? []) {
    if (!shouldShowSwitch(placeable)) continue;

    const point = canvas.stage.worldTransform.apply({ x: placeable.document.x, y: placeable.document.y });
    const distance = Math.hypot(clientX - rect.left - point.x, clientY - rect.top - point.y);
    if (distance > HIT_SIZE / 2 || distance >= closestDistance) continue;

    closestLight = placeable.document;
    closestDistance = distance;
  }

  return closestLight;
}
