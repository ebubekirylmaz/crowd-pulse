import { sql } from "./index.js";

export async function deleteExpiredDemoHosts() {
  await sql`delete from hosts where is_demo and created_at < now() - interval '24 hours'`;
}
