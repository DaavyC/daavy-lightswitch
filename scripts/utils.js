const TRUE_VALUES = [true, "true", 1, "1", "on"];

export function isTruthyValue(value) {
  if (Array.isArray(value)) return value.some(isTruthyValue);
  return TRUE_VALUES.includes(value);
}

export function cloneConfig(config) {
  return structuredClone(config ?? {});
}

export function getHTMLElement(html) {
  const element = html instanceof HTMLElement ? html : html?.[0];
  return element instanceof HTMLElement ? element : null;
}
