export function isTruthyValue(value) {
  if (Array.isArray(value)) return value.some(isTruthyValue);
  return value === true || value === "true" || value === 1 || value === "1" || value === "on";
}
