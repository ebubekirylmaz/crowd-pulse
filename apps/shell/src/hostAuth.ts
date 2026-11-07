const KEY = "cp:host-token";

export function saveToken(token: string) {
  try {
    localStorage.setItem(KEY, token);
    return true;
  } catch {
    return false;
  }
}

export function loadToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
