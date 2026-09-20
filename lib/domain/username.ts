export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

const usernamePattern = /^[a-zA-Z][a-zA-Z0-9_]{2,29}$/;

const reservedUsernames = new Set([
  "admin",
  "administrator",
  "api",
  "help",
  "official",
  "root",
  "security",
  "support",
  "system",
  "takineo",
  "talkinu",
]);

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function isValidUsernameFormat(username: string) {
  const normalized = normalizeUsername(username);

  if (
    normalized.length < USERNAME_MIN_LENGTH ||
    normalized.length > USERNAME_MAX_LENGTH
  ) {
    return false;
  }

  return usernamePattern.test(normalized);
}

export function isAllowedUsername(username: string) {
  return (
    isValidUsernameFormat(username) &&
    !reservedUsernames.has(normalizeUsername(username))
  );
}
