const TRUE_VALUES = [true, "true", 1, "1", "on"];

export function isTruthyValue(value) {
  if (Array.isArray(value)) return value.some(isTruthyValue);
  return TRUE_VALUES.includes(value);
}

export function cloneConfig(config) {
  return structuredClone(config ?? {});
}

export function getHTMLElement(html) {
  if (isHTMLElement(html)) return html;
  if (isHTMLElement(html?.[0])) return html[0];
  if (isHTMLElement(html?.get?.(0))) return html.get(0);
  return null;
}

function isHTMLElement(value) {
  return value?.nodeType === 1 && typeof value.querySelector === "function";
}
