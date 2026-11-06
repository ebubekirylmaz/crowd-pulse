import type { Question } from "../api";

export type QuestionOrder = "top" | "newest";

const time = (question: Question) => new Date(question.createdAt).getTime();

export function orderQuestions(list: Question[], order: QuestionOrder) {
  return [...list].sort((a, b) => {
    if (a.answered !== b.answered) return a.answered ? 1 : -1;
    if (order === "newest") return time(b) - time(a);
    if (a.upvotes === b.upvotes) return time(a) - time(b);
    return b.upvotes - a.upvotes;
  });
}

export function sortQuestions(list: Question[]) {
  return orderQuestions(list, "top");
}
