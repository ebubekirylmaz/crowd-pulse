const key = (code: string) => `cp:session:${code.toUpperCase()}`;

export type Session = { sessionToken: string; displayName: string };

// localStorage bazı modlarda (gizli sekme, engellenmiş site verisi) hata fırlatır;
// bu durumda oturum sadece hatırlanmaz, uygulama çalışmaya devam eder.
export function saveSession(code: string, session: Session) {
  try {
    localStorage.setItem(key(code), JSON.stringify(session));
  } catch {
    // yoksay
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
  } catch {
    // yoksay
  }
}
