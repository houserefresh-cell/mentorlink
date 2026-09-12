export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MIN_LENGTH_MESSAGE = `הסיסמה חייבת להכיל לפחות ${PASSWORD_MIN_LENGTH} תווים.`;
export const PASSWORD_CONFIRMATION_MESSAGE = "אימות הסיסמה אינו תואם.";
export const PASSWORD_SAME_MESSAGE = "הסיסמה שהזנת זהה לסיסמה הנוכחית. יש לבחור סיסמה חדשה ושונה.";
export const SUPABASE_SAME_PASSWORD_ERROR_CODE = "same_password";

export function validatePasswordChange(password: string, confirmation: string) {
  if (password.length < PASSWORD_MIN_LENGTH) return PASSWORD_MIN_LENGTH_MESSAGE;
  if (password !== confirmation) return PASSWORD_CONFIRMATION_MESSAGE;
  return "";
}

export function getSupabasePasswordError(error: { code?: string; message?: string } | null | undefined) {
  const text = error?.message ?? "";
  const code = (error?.code ?? "").toString().toLowerCase();
  if (code === SUPABASE_SAME_PASSWORD_ERROR_CODE || /same_password|same as the current password|different from the current password/i.test(text)) {
    return PASSWORD_SAME_MESSAGE;
  }
  if (/same_password|same as the current|different from the current/i.test(text)) {
    return PASSWORD_SAME_MESSAGE;
  }
  return "";
}
