const key = (code: string) => `cp:session:${code.toUpperCase()}`;

export type Session = { sessionToken: string; displayName: string };

export function saveSession(code: string, session: Session) {
  try {
    localStorage.setItem(key(code), JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function loadSession(code: string): Session | null {
  try {
    const item = localStorage.getItem(key(code));
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
}

export function clearSession(code: string) {
  try {
    localStorage.removeItem(key(code));
    return true;
  } catch {
    return false;
  }
}
