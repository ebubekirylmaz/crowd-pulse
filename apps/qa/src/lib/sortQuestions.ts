import type { Question } from "../api";

export function sortQuestions(list: Question[]) {
  return [...list].sort((a, b) => {
    if (a.upvotes === b.upvotes) {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return b.upvotes - a.upvotes;
  });
}
