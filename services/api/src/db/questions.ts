import { sql } from "./index.js";

const columns = () => sql`
  q.id,
  q.body,
  case when q.anonymous then 'Anonymous' else p.display_name end as "displayName",
  q.created_at as "createdAt",
  (q.answered_at is not null) as answered,
  count(u.question_id)::int as upvotes
`;

export async function getQuestions(roomId: string) {
  return sql`select ${columns()} from questions q join participants p on q.participant_id = p.id left join question_upvotes u on u.question_id = q.id where q.room_id = ${roomId} group by q.id, p.id order by (q.answered_at is not null) asc, upvotes desc, q.created_at asc`;
}

export async function getQuestion(questionId: string) {
  const [question] =
    await sql`select ${columns()} from questions q join participants p on q.participant_id = p.id left join question_upvotes u on u.question_id = q.id where q.id = ${questionId} group by q.id, p.id`;
  return question;
}
