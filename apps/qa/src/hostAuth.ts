const KEY = "cp:host-token";

// localStorage bazı modlarda hata fırlatır; bu durumda giriş sadece hatırlanmaz.
export function saveToken(token: string) {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // yoksay
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
  } catch {
    // yoksay
  }
}
