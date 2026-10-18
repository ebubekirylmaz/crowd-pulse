import { sql } from "./index.js";

export async function getPollResults(pollId: string) {
  return sql`select o.id, o.label, o.position, count(v.id)::int as votes from poll_options o left join votes v on v.option_id = o.id where o.poll_id = ${pollId} group by o.id order by o.position`;
}
