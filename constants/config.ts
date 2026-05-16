/**
 * App-level configuration constants.
 *
 * OWNER_EMAILS — any account whose email is in this list automatically
 * receives every feature unlocked (therapist_pro tier + therapist role)
 * regardless of their Stripe subscription status. Add your email here.
 */
export const OWNER_EMAILS: string[] = [
  // Add your email address(es) below:
  'dkoravos@gmail.com',
];

/**
 * Returns true if the given email belongs to an app owner.
 * Case-insensitive comparison.
 */
export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  return OWNER_EMAILS.some(e => e.toLowerCase().trim() === lower);
}
