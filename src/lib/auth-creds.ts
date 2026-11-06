// Shared username/password normalization so short passwords (e.g. "admin")
// satisfy the auth server's minimum length. Used for both login and account creation.
export const ADMIN_EMAIL = "admin@admin.local";

export function toLoginEmail(input: string) {
  const v = input.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@admin.local`;
}

export function toAuthPassword(pw: string) {
  return pw.length < 8 ? `${pw}#vp-ponto` : pw;
}
