// Checks if a value is considered truthy (boolean true, string "true", number 1, "1", or "on").
export function isTruthyValue(value) {
  if (Array.isArray(value)) return value.some(isTruthyValue);
  return value === true || value === "true" || value === 1 || value === "1" || value === "on";
}
