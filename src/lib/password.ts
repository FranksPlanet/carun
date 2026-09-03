// Single source of truth for password rules in RevTab.
// Used by the reset-password flow and (later) the in-Settings password change,
// so the two can never drift apart.

export const PASSWORD_MIN_LENGTH = 8;

export type PasswordCheck = { ok: true } | { ok: false; message: string };

/** Validates a candidate new password on its own (no confirmation field). */
export function validateNewPassword(password: unknown): PasswordCheck {
  if (typeof password !== "string" || password.length === 0) {
    return { ok: false, message: "Enter a new password." };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      message: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }
  if (password.trim().length === 0) {
    return { ok: false, message: "A password cannot be only spaces." };
  }
  return { ok: true };
}

/** Validates a new password together with its confirmation field. */
export function validatePasswordPair(
  password: unknown,
  confirmation: unknown,
): PasswordCheck {
  const base = validateNewPassword(password);
  if (!base.ok) return base;
  if (typeof confirmation !== "string" || confirmation.length === 0) {
    return { ok: false, message: "Confirm your new password." };
  }
  if (password !== confirmation) {
    return { ok: false, message: "Those two passwords don't match." };
  }
  return { ok: true };
}
