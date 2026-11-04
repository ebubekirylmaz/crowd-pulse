const voteKey = (pollId: string) => `cp:vote:${pollId}`;
const upvotesKey = (code: string) => `cp:upvotes:${code.toUpperCase()}`;

export function loadVote(pollId: string): string | null {
  try {
    return localStorage.getItem(voteKey(pollId));
  } catch {
    return null;
  }
}

export function saveVote(pollId: string, optionId: string) {
  try {
    localStorage.setItem(voteKey(pollId), optionId);
    return true;
  } catch {
    return false;
  }
}

export function loadUpvotes(code: string): string[] {
  try {
    const raw = localStorage.getItem(upvotesKey(code));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUpvotes(code: string, ids: string[]) {
  try {
    localStorage.setItem(upvotesKey(code), JSON.stringify(ids));
    return true;
  } catch {
    return false;
  }
}
