// Utility functions for user display

type User = {
  name: string | null;
  email: string | null;
};

/**
 * Get display name for user - uses name if available, otherwise email prefix
 */
export function getUserDisplayName(user: User | null | undefined): string {
  if (!user) return "Usuário";
  if (user.name) return user.name;
  if (user.email) return user.email.split("@")[0];
  return "Usuário";
}

/**
 * Get initials for avatar - uses name first letter, then email first letter
 */
export function getUserInitials(user: User | null | undefined): string {
  if (!user) return "U";
  if (user.name) return user.name.charAt(0).toUpperCase();
  if (user.email) return user.email.charAt(0).toUpperCase();
  return "U";
}



