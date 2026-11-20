// Where the sign-in is kept, and when a remembered one expires.
//  - «تذكّرني على هذا الجهاز» on (default): kept in localStorage, survives
//    closing the browser.
//  - off (shared device): kept in sessionStorage, gone when the browser closes.
//  - A remembered sign-in unused for 30 days on this device asks for a new code.

export const rememberKey = 'bipilo-remember';
export const lastActiveKey = 'bipilo-last-active';
export const idleLimitMs = 30 * 86400000;
export const isAuthKey = (key) => /^sb-.+-auth-token(-code-verifier)?$/.test(String(key));

export function remembered(local) {
  try {
    return local.getItem(rememberKey) !== '0';
  } catch {
    return true;
  }
}

export function setRemembered(local, on) {
  try {
    local.setItem(rememberKey, on ? '1' : '0');
  } catch {
    // Without storage the sign-in simply stays in this tab.
  }
}

// Storage handed to the Supabase client: it reads either place and writes
// only where the current choice says.
export function authStorage(local, session) {
  return {
    getItem(key) {
      try {
        return session.getItem(key) ?? local.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        if (remembered(local)) {
          local.setItem(key, value);
          session.removeItem(key);
        } else {
          session.setItem(key, value);
          local.removeItem(key);
        }
      } catch {
        // Private modes can refuse storage; the sign-in then lasts this page.
      }
    },
    removeItem(key) {
      for (const place of [local, session]) {
        try {
          place.removeItem(key);
        } catch {
          // Nothing to remove.
        }
      }
    },
  };
}

// Run once when the site opens. Returns true when a stale remembered sign-in
// was removed; otherwise records today's visit.
export function expireIdleSession(local, now = Date.now(), limit = idleLimitMs) {
  const keys = [];
  for (let index = 0; index < local.length; index++) {
    const key = local.key(index);
    if (isAuthKey(key)) keys.push(key);
  }
  if (!keys.length) return false;
  const last = Number(local.getItem(lastActiveKey));
  if (last && now - last > limit) {
    for (const key of keys) local.removeItem(key);
    local.removeItem(lastActiveKey);
    return true;
  }
  local.setItem(lastActiveKey, String(now));
  return false;
}
