import {
  AMBIENT_LIGHT_TYPE,
  CIRCUIT_COLOR,
  CIRCUIT_LINE_WIDTH,
  CIRCUIT_SELECTED_COLOR,
  CIRCUIT_TOOL_NAME,
  FLAGS,
  HIT_SIZE,
  I18N_PREFIX,
  IS_OFF_PATH,
  MODULE_ID,
  PLAYER_TOGGLE_PATH,
  RESTORE_CONFIG_PATH,
  TOGGLE_QUERY
} from "./constants.js";
import { registerHooks } from "./hooks.js";
import { getCanvasElement, getCanvasScale, getHTMLElement, isPointWithinGridDistance, isTruthyValue } from "./utils.js";
import {
  doesInteractionDistanceAffectGM,
  getInteractionDistance,
  getPlayerToggleDefault,
  isInteractionDistanceLimited,
  shouldShowForGM
} from "./settings.js";

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
    [`flags.${MODULE_ID}.-=${FLAGS.RESTORE_CONFIG}`]: null
  };

  if (restoreConfig && typeof restoreConfig === "object") update.config = structuredClone(restoreConfig);
  return update;
}

function registerSocket() {
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
    const updates = buildValidatedToggleUpdates(light, game.user, { allowGM: true, tokenIds: ids.tokenIds });
    if (!updates) return { ok: false, reason: "rejected" };
    await light.parent.updateEmbeddedDocuments(AMBIENT_LIGHT_TYPE, updates);
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
  const updates = buildValidatedToggleUpdates(light, user, { tokenIds: payload?.tokenIds });

  if (!scene || !light || !updates) return { ok: false, reason: "rejected" };

  await scene.updateEmbeddedDocuments(AMBIENT_LIGHT_TYPE, updates);
  return { ok: true };
}

function buildValidatedToggleUpdates(light, user, { allowGM = false, tokenIds = [] } = {}) {
  if (!light || !user) return null;
  if (user.isGM && !allowGM) return null;
  if (!isInteractionInRange(light, user, tokenIds)) return null;
  if (!isToggleAllowed(light)) return null;

  const turnOff = !isLightOff(light);
  return buildLightStateUpdates(getCircuitMembers(light), turnOff);
}

function buildLightStateUpdates(lights, turnOff) {
  return lights.flatMap((member) => {
    if (isLightOff(member) === turnOff) return [];
    return [{ _id: member.id, ...(turnOff ? buildTurnOffUpdate(member) : buildTurnOnUpdate(member)) }];
  });
}

function getCircuitMembers(light) {
  const scene = light.parent;
  const links = getCircuitLinks(scene);
  const memberIds = new Set([light.id]);
  const pending = [light.id];

  while (pending.length) {
    const currentId = pending.pop();
    for (const [firstId, secondId] of links) {
      const linkedId = firstId === currentId ? secondId : secondId === currentId ? firstId : null;
      if (!linkedId || memberIds.has(linkedId)) continue;
      memberIds.add(linkedId);
      pending.push(linkedId);
    }
  }

  return [...memberIds]
    .map((id) => scene.getEmbeddedDocument(AMBIENT_LIGHT_TYPE, id))
    .filter(Boolean);
}

function getCircuitLinks(scene) {
  const validIds = new Set([...(scene?.lights ?? [])].map((light) => light.id));
  const links = scene?.getFlag?.(MODULE_ID, FLAGS.CIRCUIT_LINKS);
  const parents = new Map();

  if (!Array.isArray(links)) return [];
  return links.flatMap((link) => {
    if (!Array.isArray(link) || link.length !== 2) return [];
    const [firstId, secondId] = link.map(String).sort();
    if (firstId === secondId || !validIds.has(firstId) || !validIds.has(secondId)) return [];
    const firstRoot = findCircuitRoot(parents, firstId);
    const secondRoot = findCircuitRoot(parents, secondId);
    if (firstRoot === secondRoot) return [];
    parents.set(secondRoot, firstRoot);
    return [[firstId, secondId]];
  });
}

function findCircuitRoot(parents, id) {
  while (parents.has(id)) id = parents.get(id);
  return id;
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

function setDefaultPlayerToggleFlag(document, creationData) {
  const currentValue = getFlagUpdateValue(creationData);
  const value = currentValue === undefined ? getPlayerToggleDefault() : isTruthyValue(currentValue);

  document.updateSource?.({ [PLAYER_TOGGLE_PATH]: value });
  foundry.utils.setProperty(creationData, PLAYER_TOGGLE_PATH, value);
}

function normalizePlayerToggleFlag(document, change) {
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

function addPlayerToggleField(app, html) {
  if (!game.user.isGM) return;

  const element = getHTMLElement(html);
  if (!element) return;

  const currentValue = app.document.getFlag(MODULE_ID, FLAGS.PLAYER_TOGGLE_ENABLED);
  const checked = currentValue === undefined ? getPlayerToggleDefault() : isTruthyValue(currentValue);
  const hidden = createPlayerToggleInput("hidden", false);
  const checkbox = createPlayerToggleInput("checkbox", true, checked);
  const group = foundry.applications.fields.createFormGroup({
    input: checkbox,
    label: `${I18N_PREFIX}.AmbientLightConfig.PlayerToggleEnabled.Label`,
    hint: `${I18N_PREFIX}.AmbientLightConfig.PlayerToggleEnabled.Hint`,
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
let pendingCanvasRefresh = null;
let circuitLayer;
let circuitToolActive = false;
let circuitDrag = null;
let circuitChainSource = null;
let circuitSelectionDrag = null;
const selectedCircuitLightIds = new Set();
let circuitShiftActive = false;
let circuitCanvasElement;
let circuitKeyboardHandlerInstalled = false;
let circuitSceneId = null;

function addCircuitTool(controls) {
  const lighting = controls?.lighting;
  if (!lighting?.tools) return;

  for (const tool of Object.values(lighting.tools)) {
    if (tool.order >= 3) tool.order += 1;
  }

  lighting.tools[CIRCUIT_TOOL_NAME] = {
    name: CIRCUIT_TOOL_NAME,
    title: `${I18N_PREFIX}.Circuits.Title`,
    icon: "fa-solid fa-link",
    order: 3,
    visible: game.user.isGM,
    toolclip: {
      heading: `${I18N_PREFIX}.Circuits.Title`,
      items: [
        { paragraph: `${I18N_PREFIX}.Circuits.Description` },
        { heading: `${I18N_PREFIX}.Circuits.Actions.Connect`, reference: "CONTROLS.ClickDrag" },
        { heading: `${I18N_PREFIX}.Circuits.Actions.Chain`, content: "CONTROLS.ChainCtrlClick" },
        { heading: `${I18N_PREFIX}.Circuits.Actions.Select`, content: `${I18N_PREFIX}.Circuits.Shortcuts.Select` },
        { heading: `${I18N_PREFIX}.Circuits.Actions.SelectAll`, reference: `${I18N_PREFIX}.Circuits.Shortcuts.SelectAll` },
        { heading: `${I18N_PREFIX}.Circuits.Actions.Delete`, reference: "CONTROLS.Delete" },
        { heading: `${I18N_PREFIX}.Circuits.Actions.Remove`, reference: "CONTROLS.RightClick" }
      ]
    },
    onChange: (_event, active) => {
      if (!active) {
        releaseCircuitPointer(circuitDrag?.pointerId);
        releaseCircuitPointer(circuitSelectionDrag?.pointerId);
      }
      circuitToolActive = active;
      circuitShiftActive = active && game.keyboard.isModifierActive("SHIFT");
      circuitDrag = null;
      circuitChainSource = null;
      circuitSelectionDrag = null;
      selectedCircuitLightIds.clear();
      refreshCircuitLines();
    }
  };
}

function scheduleCanvasRefresh() {
  if (pendingCanvasRefresh !== null) return;

  pendingCanvasRefresh = setTimeout(() => {
    pendingCanvasRefresh = null;
    refreshLightSwitches();
    refreshCircuitLines();
  }, 0);
}

function refreshCircuitLines() {
  if (!globalThis.canvas?.ready || !globalThis.PIXI) return;

  if (circuitSceneId !== canvas.scene?.id) {
    circuitSceneId = canvas.scene?.id ?? null;
    releaseCircuitPointer(circuitDrag?.pointerId);
    releaseCircuitPointer(circuitSelectionDrag?.pointerId);
    circuitDrag = null;
    circuitChainSource = null;
    circuitSelectionDrag = null;
    selectedCircuitLightIds.clear();
    circuitShiftActive = false;
  }

  ensureCircuitLayer();
  circuitLayer.removeChildren().forEach((child) => child.destroy());
  installCircuitCanvasHandlers();
  if (!game.user.isGM || !isLightingControlsActive()) return;

  const lights = new Map((canvas.lighting?.placeables ?? []).map((placeable) => [placeable.document.id, placeable.document]));
  const lineWidth = CIRCUIT_LINE_WIDTH / getCanvasScale();
  const links = getCircuitLinks(canvas.scene);
  for (const [firstId, secondId] of links) {
    const first = lights.get(firstId);
    const second = lights.get(secondId);
    if (!first || !second) continue;
    const selected = circuitToolActive && (selectedCircuitLightIds.has(firstId) || selectedCircuitLightIds.has(secondId));
    circuitLayer.addChild(createCircuitLine(
      first,
      second,
      selected ? lineWidth * 1.5 : lineWidth,
      selected ? 1 : 0.95,
      selected ? CIRCUIT_SELECTED_COLOR : CIRCUIT_COLOR
    ));
  }

  if (circuitToolActive) {
    if (circuitShiftActive) {
      for (const id of new Set(links.flat())) {
        const light = lights.get(id);
        if (light && !selectedCircuitLightIds.has(id)) circuitLayer.addChild(createCircuitSelectionMarker(light, CIRCUIT_COLOR));
      }
    }
    for (const id of selectedCircuitLightIds) {
      const light = lights.get(id);
      if (light) circuitLayer.addChild(createCircuitSelectionMarker(light, CIRCUIT_SELECTED_COLOR));
    }
  }
}

function ensureCircuitLayer() {
  if (circuitLayer && !circuitLayer.destroyed) return;

  circuitLayer = new PIXI.Container();
  circuitLayer.name = "daavyLightswitchCircuitLayer";
  circuitLayer.eventMode = "none";
  circuitLayer.zIndex = 9_999;
  canvas.stage.sortableChildren = true;
  canvas.stage.addChild(circuitLayer);
}

function createCircuitLine(first, second, width, alpha = 0.95, color = CIRCUIT_COLOR) {
  return new PIXI.Graphics()
    .lineStyle(width, color, alpha)
    .moveTo(first.x, first.y)
    .lineTo(second.x, second.y);
}

function createCircuitSelectionMarker(light, color) {
  const scale = getCanvasScale();
  return new PIXI.Graphics()
    .lineStyle(2 / scale, color, 1)
    .beginFill(color, 0.15)
    .drawCircle(light.x, light.y, HIT_SIZE / 2 / scale)
    .endFill();
}

function installCircuitCanvasHandlers() {
  const element = getCanvasElement();
  if (!element || circuitCanvasElement === element) return;

  circuitCanvasElement?.removeEventListener("pointerdown", handleCircuitPointerDown, true);
  circuitCanvasElement?.removeEventListener("pointermove", handleCircuitPointerMove, true);
  circuitCanvasElement?.removeEventListener("pointerup", handleCircuitPointerUp, true);
  circuitCanvasElement?.removeEventListener("pointercancel", cancelCircuitInteraction, true);
  circuitCanvasElement?.removeEventListener("contextmenu", handleCircuitContextMenu, true);
  circuitCanvasElement = element;
  element.addEventListener("pointerdown", handleCircuitPointerDown, true);
  element.addEventListener("pointermove", handleCircuitPointerMove, true);
  element.addEventListener("pointerup", handleCircuitPointerUp, true);
  element.addEventListener("pointercancel", cancelCircuitInteraction, true);
  element.addEventListener("contextmenu", handleCircuitContextMenu, true);
  if (!circuitKeyboardHandlerInstalled) {
    document.addEventListener("keydown", handleCircuitKeyDown, true);
    document.addEventListener("keyup", handleCircuitKeyUp, true);
    window.addEventListener("blur", handleCircuitWindowBlur);
    circuitKeyboardHandlerInstalled = true;
  }
}

function isCircuitEditingActive() {
  return game.user.isGM && circuitToolActive && isLightingControlsActive();
}

function consumeCircuitEvent(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function handleCircuitPointerDown(event) {
  if (event.button !== 0 || !isCircuitEditingActive()) return;
  const point = getCanvasPoint(event);
  const light = getLightAtCanvasPoint(point);

  if (event.shiftKey) {
    consumeCircuitEvent(event);
    circuitChainSource = null;
    if (light && isLightInCircuit(light.id)) {
      if (selectedCircuitLightIds.has(light.id)) selectedCircuitLightIds.delete(light.id);
      else selectedCircuitLightIds.add(light.id);
      refreshCircuitLines();
      return;
    }

    circuitSelectionDrag = { origin: point, pointerId: event.pointerId };
    circuitCanvasElement.setPointerCapture?.(event.pointerId);
    return;
  }

  if (selectedCircuitLightIds.size) {
    consumeCircuitEvent(event);
    selectedCircuitLightIds.clear();
    cancelCircuitInteraction();
    return;
  }

  if (circuitChainSource) {
    if (!light || light.id === circuitChainSource.id) return;
    consumeCircuitEvent(event);
    const source = circuitChainSource;
    const keepChaining = event.ctrlKey || event.metaKey;
    circuitChainSource = null;
    refreshCircuitLines();
    addCircuitLink(source.id, light.id).then((linked) => {
      if (linked && keepChaining) circuitChainSource = light;
      else if (!linked) circuitChainSource = source;
      refreshCircuitLines();
    }).catch((error) => {
      circuitChainSource = source;
      console.error(`${MODULE_ID} | Failed to link circuit lights`, error);
    });
    return;
  }

  if (!light) return;

  consumeCircuitEvent(event);
  circuitDrag = { light, pointerId: event.pointerId };
  circuitCanvasElement.setPointerCapture?.(event.pointerId);
}

function handleCircuitPointerMove(event) {
  if (circuitSelectionDrag && event.pointerId === circuitSelectionDrag.pointerId) {
    consumeCircuitEvent(event);
    refreshCircuitLines();
    drawCircuitSelectionPreview(circuitSelectionDrag.origin, getCanvasPoint(event));
    return;
  }

  if (circuitChainSource && isCircuitEditingActive()) {
    const point = getCanvasPoint(event);
    const target = getLightAtCanvasPoint(point);
    refreshCircuitLines();
    drawCircuitPreview(circuitChainSource, target && target.id !== circuitChainSource.id ? target : point);
    return;
  }

  if (!circuitDrag || event.pointerId !== circuitDrag.pointerId) return;

  consumeCircuitEvent(event);
  const point = getCanvasPoint(event);
  const target = getLightAtCanvasPoint(point);
  const end = target && target.id !== circuitDrag.light.id ? target : point;
  refreshCircuitLines();
  drawCircuitPreview(circuitDrag.light, end);
}

function handleCircuitPointerUp(event) {
  if (circuitSelectionDrag && event.pointerId === circuitSelectionDrag.pointerId) {
    consumeCircuitEvent(event);
    const rectangle = getCircuitRectangle(circuitSelectionDrag.origin, getCanvasPoint(event));
    const circuitIds = new Set(getCircuitLinks(canvas.scene).flat());
    for (const placeable of canvas.lighting?.placeables ?? []) {
      const { id, x, y } = placeable.document;
      if (circuitIds.has(id) && x >= rectangle.x && x <= rectangle.x + rectangle.width
        && y >= rectangle.y && y <= rectangle.y + rectangle.height) selectedCircuitLightIds.add(id);
    }
    finishCircuitSelection();
    return;
  }

  if (!circuitDrag || event.pointerId !== circuitDrag.pointerId) return;

  consumeCircuitEvent(event);
  const source = circuitDrag.light;
  const target = getLightAtCanvasPoint(getCanvasPoint(event));
  const keepChaining = event.ctrlKey || event.metaKey;
  finishCircuitDrag();
  if (!target || target.id === source.id) return;

  addCircuitLink(source.id, target.id).then((linked) => {
    if (keepChaining) circuitChainSource = linked ? target : source;
    refreshCircuitLines();
  }).catch((error) => {
    if (keepChaining) circuitChainSource = source;
    console.error(`${MODULE_ID} | Failed to link circuit lights`, error);
  });
}

function drawCircuitPreview(source, end) {
  circuitLayer.addChild(createCircuitLine(source, end, CIRCUIT_LINE_WIDTH / getCanvasScale(), 0.65));
}

function drawCircuitSelectionPreview(origin, destination) {
  const rectangle = getCircuitRectangle(origin, destination);
  const scale = getCanvasScale();
  circuitLayer.addChild(new PIXI.Graphics()
    .lineStyle(2 / scale, CIRCUIT_SELECTED_COLOR, 1)
    .beginFill(CIRCUIT_SELECTED_COLOR, 0.12)
    .drawRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height)
    .endFill());
}

function getCircuitRectangle(origin, destination) {
  return {
    x: Math.min(origin.x, destination.x),
    y: Math.min(origin.y, destination.y),
    width: Math.abs(destination.x - origin.x),
    height: Math.abs(destination.y - origin.y)
  };
}

function finishCircuitDrag() {
  if (!circuitDrag) return;
  releaseCircuitPointer(circuitDrag.pointerId);
  circuitDrag = null;
  refreshCircuitLines();
}

function finishCircuitSelection() {
  if (!circuitSelectionDrag) return;
  releaseCircuitPointer(circuitSelectionDrag.pointerId);
  circuitSelectionDrag = null;
  refreshCircuitLines();
}

function cancelCircuitInteraction(event) {
  finishCircuitDrag();
  finishCircuitSelection();
  circuitChainSource = null;
  refreshCircuitLines();
  event?.preventDefault?.();
}

function releaseCircuitPointer(pointerId) {
  if (pointerId !== undefined && circuitCanvasElement?.hasPointerCapture?.(pointerId)) {
    circuitCanvasElement.releasePointerCapture(pointerId);
  }
}

async function addCircuitLink(firstId, secondId) {
  const scene = canvas.scene;
  const source = scene.getEmbeddedDocument(AMBIENT_LIGHT_TYPE, firstId);
  if (!source || !scene.getEmbeddedDocument(AMBIENT_LIGHT_TYPE, secondId)) return false;

  const links = getCircuitLinks(scene);
  const link = [firstId, secondId].sort();
  if (getCircuitMembers(source).some((member) => member.id === secondId)) return false;
  const turnOff = isLightOff(source);
  await scene.setFlag(MODULE_ID, FLAGS.CIRCUIT_LINKS, [...links, link]);

  const updates = buildLightStateUpdates(getCircuitMembers(source), turnOff);
  if (updates.length) await scene.updateEmbeddedDocuments(AMBIENT_LIGHT_TYPE, updates);
  return true;
}

function handleCircuitKeyDown(event) {
  if (!isCircuitEditingActive() || event.target?.closest?.("input, textarea, select, [contenteditable='true']")) return;

  if (event.key === "Shift") {
    if (!circuitShiftActive) {
      circuitShiftActive = true;
      refreshCircuitLines();
    }
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
    consumeCircuitEvent(event);
    circuitChainSource = null;
    selectedCircuitLightIds.clear();
    for (const [firstId, secondId] of getCircuitLinks(canvas.scene)) {
      selectedCircuitLightIds.add(firstId);
      selectedCircuitLightIds.add(secondId);
    }
    refreshCircuitLines();
    return;
  }

  if (event.key === "Escape") {
    if (!circuitChainSource && !circuitDrag && !circuitSelectionDrag && !selectedCircuitLightIds.size) return;
    consumeCircuitEvent(event);
    selectedCircuitLightIds.clear();
    cancelCircuitInteraction();
    return;
  }

  if (!selectedCircuitLightIds.size || !["Backspace", "Delete"].includes(event.key)) return;
  const links = getCircuitLinks(canvas.scene);
  const remaining = links.filter(([firstId, secondId]) => (
    !selectedCircuitLightIds.has(firstId) && !selectedCircuitLightIds.has(secondId)
  ));
  if (remaining.length === links.length) return;

  consumeCircuitEvent(event);
  selectedCircuitLightIds.clear();
  canvas.scene.setFlag(MODULE_ID, FLAGS.CIRCUIT_LINKS, remaining).then(refreshCircuitLines).catch((error) => {
    console.error(`${MODULE_ID} | Failed to delete selected circuit links`, error);
  });
}

function handleCircuitKeyUp(event) {
  if (event.key !== "Shift" || !circuitShiftActive) return;
  circuitShiftActive = false;
  refreshCircuitLines();
}

function handleCircuitWindowBlur() {
  if (!circuitShiftActive) return;
  circuitShiftActive = false;
  refreshCircuitLines();
}

function handleCircuitContextMenu(event) {
  if (!isCircuitEditingActive()) return;
  const point = getCanvasPoint(event);
  const links = getCircuitLinks(canvas.scene);
  const index = findCircuitLinkAtPoint(links, point);
  if (index < 0) {
    if (!circuitChainSource) return;
    consumeCircuitEvent(event);
    circuitChainSource = null;
    refreshCircuitLines();
    return;
  }

  consumeCircuitEvent(event);
  links.splice(index, 1);
  canvas.scene.setFlag(MODULE_ID, FLAGS.CIRCUIT_LINKS, links).catch((error) => {
    console.error(`${MODULE_ID} | Failed to unlink circuit lights`, error);
  });
}

function findCircuitLinkAtPoint(links, point) {
  const tolerance = 8 / getCanvasScale();
  for (let index = links.length - 1; index >= 0; index -= 1) {
    const first = canvas.scene.getEmbeddedDocument(AMBIENT_LIGHT_TYPE, links[index][0]);
    const second = canvas.scene.getEmbeddedDocument(AMBIENT_LIGHT_TYPE, links[index][1]);
    if (first && second && distanceToSegment(point, first, second) <= tolerance) return index;
  }
  return -1;
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (!dx && !dy) return Math.hypot(point.x - start.x, point.y - start.y);
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - start.x - ratio * dx, point.y - start.y - ratio * dy);
}

function getCanvasPoint(event) {
  return canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
}

function getLightAtCanvasPoint(point) {
  const tolerance = HIT_SIZE / 2 / getCanvasScale();
  let closest = null;
  let closestDistance = tolerance;
  for (const placeable of canvas.lighting?.placeables ?? []) {
    const distance = Math.hypot(point.x - placeable.document.x, point.y - placeable.document.y);
    if (distance >= closestDistance) continue;
    closest = placeable.document;
    closestDistance = distance;
  }
  return closest;
}

function isLightInCircuit(lightId) {
  return getCircuitLinks(canvas.scene).some(([firstId, secondId]) => firstId === lightId || secondId === lightId);
}

function refreshLightSwitches() {
  if (!globalThis.canvas?.ready || !globalThis.PIXI) return;

  ensureSwitchLayer();
  switchLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
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
  switchLayer.name = "daavyLightswitchLayer";
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
  button.scale.set(1 / getCanvasScale());
  graphics
    .lineStyle(2, off ? 0xb8b8b8 : 0xffd76a, 0.95)
    .beginFill(off ? 0x2c2c2c : 0xffd76a, off ? 0.88 : 0.95)
    .drawCircle(0, 0, 14)
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

registerHooks({
  addCircuitTool,
  addPlayerToggleField,
  normalizePlayerToggleFlag,
  refreshCircuitLines,
  refreshLightSwitches,
  registerSocket,
  scheduleCanvasRefresh,
  setDefaultPlayerToggleFlag
});
