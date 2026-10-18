import { sql } from "./index.js";

export async function getQuestions(roomId: string) {
  return sql`select q.id, q.body, p.display_name as "displayName", q.created_at as "createdAt", count(u.question_id)::int as upvotes from questions q join participants p on q.participant_id = p.id left join question_upvotes u on u.question_id = q.id where q.room_id = ${roomId} group by q.id, p.id order by upvotes desc, q.created_at asc`;
}

export async function getQuestion(questionId: string) {
  const [question] =
    await sql`select q.id, q.body, p.display_name as "displayName", q.created_at as "createdAt", count(u.question_id)::int as upvotes from questions q join participants p on q.participant_id = p.id left join question_upvotes u on u.question_id = q.id where q.id = ${questionId} group by q.id, p.id`;
  return question;
}
