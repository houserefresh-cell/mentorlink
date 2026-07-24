export function normalizeIsraeliPhone(value: string) {
  const compact = value.trim().replace(/[\s()-]/g, "");

  if (/^05\d{8}$/.test(compact)) {
    return `+972${compact.slice(1)}`;
  }

  if (/^9725\d{8}$/.test(compact)) {
    return `+${compact}`;
  }

  if (/^\+9725\d{8}$/.test(compact)) {
    return compact;
  }

  return null;
}

export function formatIsraeliPhone(value: string) {
  const normalized = normalizeIsraeliPhone(value);

  if (!normalized) {
    return value;
  }

  return `0${normalized.slice(4, 6)}-${normalized.slice(6, 9)}-${normalized.slice(9)}`;
}
