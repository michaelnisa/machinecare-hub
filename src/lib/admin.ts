export const PLATFORM_ADMIN_EMAILS = [
  "michaelnisa3@gmail.com",
];

export function isPlatformAdmin(email?: string | null): boolean {
  if (!email) return false;
  return PLATFORM_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
