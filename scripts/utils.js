const TRUE_VALUES = [true, "true", 1, "1", "on"];

export function isTruthyValue(value) {
  if (Array.isArray(value)) return value.some(isTruthyValue);
  return TRUE_VALUES.includes(value);
}

export function cloneConfig(config) {
  return structuredClone(config ?? {});
}

export function isPointWithinGridDistance(point, rectangle, gridSize, maxDistance) {
  if (gridSize <= 0 || maxDistance < 0) return false;

  const dx = Math.max(rectangle.x - point.x, 0, point.x - rectangle.x - rectangle.width);
  const dy = Math.max(rectangle.y - point.y, 0, point.y - rectangle.y - rectangle.height);
  return Math.hypot(dx, dy) <= maxDistance * gridSize;
}

function isElement(element) {
  return !!element
    && typeof element === "object"
    && element.nodeType === 1
    && typeof element.querySelector === "function";
}

export function getHTMLElement(html) {
  if (isElement(html)) return html;
  if (isElement(html?.[0])) return html[0];
  return null;
}

export function getDocument(element = null) {
  return element?.ownerDocument ?? globalThis.document;
}
