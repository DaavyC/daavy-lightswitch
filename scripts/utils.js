const TRUE_VALUES = [true, "true", 1, "1", "on"];

export function isTruthyValue(value) {
  if (Array.isArray(value)) return value.some(isTruthyValue);
  return TRUE_VALUES.includes(value);
}

export function isPointWithinGridDistance(point, rectangle, gridSize, maxDistance) {
  if (gridSize <= 0 || maxDistance < 0) return false;

  const dx = Math.max(rectangle.x - point.x, 0, point.x - rectangle.x - rectangle.width);
  const dy = Math.max(rectangle.y - point.y, 0, point.y - rectangle.y - rectangle.height);
  return Math.hypot(dx, dy) <= maxDistance * gridSize;
}

export function getHTMLElement(html) {
  const element = html?.nodeType === 1 ? html : html?.[0];
  return element?.nodeType === 1 ? element : null;
}
