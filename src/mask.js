export function mask(value, visible = 0) {
  const s = String(value ?? "");
  if (visible <= 0 || s.length <= visible * 2) return "********";
  return s.slice(0, visible) + "********";
}
