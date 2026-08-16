export const SHARE_TOKEN_STORAGE_KEY = "edms.shareToken";

export function getShareToken(): string | null {
  return sessionStorage.getItem(SHARE_TOKEN_STORAGE_KEY);
}

export function setShareToken(token: string | null): void {
  if (token) {
    sessionStorage.setItem(SHARE_TOKEN_STORAGE_KEY, token);
  } else {
    sessionStorage.removeItem(SHARE_TOKEN_STORAGE_KEY);
  }
}
