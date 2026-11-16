// When the user was last active, shared across tabs and surviving a closed browser.

export const IDLE_MS = (Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES) || 15) * 60_000;

const STORAGE_KEY = 'ffs_last_activity';

export const readLastActivity = () => {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
};

export const writeLastActivity = (now = Date.now()) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(now));
  } catch {
    // Private mode: per-tab tracking still works
  }
};

/** True when a saved session has sat unused for too long. No record means nothing to judge by. */
export const idleExpired = (now = Date.now()) => {
  const last = readLastActivity();
  return last > 0 && now - last >= IDLE_MS;
};
