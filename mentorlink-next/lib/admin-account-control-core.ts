export type MentorAccountAction =
  | { action: "suspend"; reason: string; suspendedUntil: string }
  | { action: "block"; reason: string }
  | { action: "restore"; reason: string }
  | { action: "permanently_delete"; reason: string; confirmation: string };

export class MentorAccountControlInputError extends Error {}

function reason(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (normalized.length < 3 || normalized.length > 1000) {
    throw new MentorAccountControlInputError("יש להזין סיבה באורך 3–1,000 תווים.");
  }
  return normalized;
}

export function parseMentorAccountAction(value: unknown): MentorAccountAction {
  if (!value || typeof value !== "object") throw new MentorAccountControlInputError("פעולת החשבון חסרה.");
  const input = value as Record<string, unknown>;
  if (input.action === "suspend") {
    const suspendedUntil = typeof input.suspendedUntil === "string" ? input.suspendedUntil : "";
    const parsed = Date.parse(suspendedUntil);
    if (!Number.isFinite(parsed) || parsed <= Date.now()) throw new MentorAccountControlInputError("יש לבחור מועד סיום עתידי להשבתה.");
    return { action: "suspend", reason: reason(input.reason), suspendedUntil: new Date(parsed).toISOString() };
  }
  if (input.action === "block") return { action: "block", reason: reason(input.reason) };
  if (input.action === "restore") return { action: "restore", reason: reason(input.reason) };
  if (input.action === "permanently_delete") {
    if (input.confirmation !== "מחיקה לצמיתות") throw new MentorAccountControlInputError("יש להקליד „מחיקה לצמיתות” כדי לאשר.");
    return { action: "permanently_delete", reason: reason(input.reason), confirmation: "מחיקה לצמיתות" };
  }
  throw new MentorAccountControlInputError("פעולת החשבון אינה נתמכת.");
}
