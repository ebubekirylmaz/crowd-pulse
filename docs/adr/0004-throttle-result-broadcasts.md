# 0004: Throttle poll result broadcasts to one per 150 ms per poll

Status: accepted

## Context

Every accepted vote used to broadcast the full, up to date poll results to everyone in the room. That is one message per vote per connected socket, so a room with N voters produces about N x N messages. The first load test showed what that costs on a single API instance (everything on one laptop, one load generator process):

| Scenario | Vote acknowledged p95 | Vote visible on host p95 |
| --- | --- | --- |
| 200 voters over 3 s | 10 ms | 7 ms |
| 1,000 voters over 3 s | 1,225 ms | 901 ms |
| 1,000 voters over 0.5 s | 3,014 ms | 1,980 ms |

Connections and correctness were fine at every size (all sockets connected, accepted, broadcast and stored totals matched). The slowdown came from fan-out, not from counting votes in Postgres.

## Decision

- Keep broadcasting the **full results** (not deltas), so skipping an intermediate broadcast loses nothing: every message already contains the complete state.
- Broadcast **immediately for the first vote** after a quiet period, then at most **once per 150 ms** per poll. Votes that arrive during the cooldown only mark the poll as changed, and one trailing broadcast is sent when the cooldown ends. The trailing broadcast re-reads the totals from Postgres, so the last message always carries the final counts.
- Acknowledge the vote right after it is stored, without waiting for the broadcast.
- The state lives per process. With several API instances each one throttles its own votes, and the Redis adapter delivers the broadcasts to every instance. The last broadcast after the last vote still reads the final totals from the database.

## Consequences

After the change, same machine, same test:

| Scenario | Vote acknowledged p95 | Vote visible on host p95 |
| --- | --- | --- |
| 200 voters over 3 s | 10 ms | 160 ms |
| 1,000 voters over 3 s | 17 ms | 158 ms |
| 1,000 voters over 0.5 s | 7 ms | 151 ms |
| 5,000 voters over 5 s | 59 ms | 182 ms |

- Under load, acknowledgements dropped from seconds to milliseconds and the time until the host sees a vote is bounded by roughly the throttle interval instead of growing with the audience.
- Trade-off: in a small, quiet room a vote can take up to about 150 ms to appear on screens after the first one, where it used to take a few milliseconds. For a live results chart this is not noticeable, and the interval is a single constant.
- A vote that arrives mid-cooldown can cause one extra broadcast that already contained it, which is harmless.
- The load test runs the load generator and the server on one machine, so the numbers are a conservative floor for the server and not a production benchmark.

## Alternatives considered

- **Send vote deltas** instead of full results: smaller messages, but clients must apply them in order and recover from gaps. Full state with throttling is simpler and just as effective here.
- **Counters in Redis** with periodic persistence: the measurements show counting was not the bottleneck, so this would add a second source of truth for no gain.
- **Throttle on the client**: still pays the server cost of producing and sending every message.
