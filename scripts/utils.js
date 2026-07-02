const TRUE_VALUES = [true, "true", 1, "1", "on"];

export function isTruthyValue(value) {
  if (Array.isArray(value)) return value.some(isTruthyValue);
  return TRUE_VALUES.includes(value);
}

export function cloneConfig(config) {
  return structuredClone(config ?? {});
}

export function getHTMLElement(html) {
  if (typeof HTMLElement !== "undefined" && html instanceof HTMLElement) return html;
  if (typeof html?.querySelector === "function") return html;
  if (Array.isArray(html)) return html[0] ?? null;
  if (html?.jquery) return html[0] ?? null;
  if (typeof html?.get === "function") return html.get(0) ?? null;
  return null;
}
