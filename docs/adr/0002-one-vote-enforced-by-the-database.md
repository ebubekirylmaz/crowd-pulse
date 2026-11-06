# 0002: One vote per participant, enforced by the database

Status: accepted

## Context

Participants join with only a display name, there are no accounts. Each participant may vote once per poll and upvote a question once. Votes arrive concurrently over WebSockets, so two requests from the same participant can be in flight at the same time.

## Decision

- Identify a participant by a random 256-bit **session token** issued when they join. It is stored in the browser (`localStorage`) so a refresh or reconnect keeps the same identity.
- Enforce uniqueness with database constraints: `unique (poll_id, participant_id)` on `votes` and a composite primary key `(question_id, participant_id)` on `question_upvotes`.
- Insert directly and treat the unique violation (`23505`) as the normal "already voted" answer, instead of checking first and inserting second. Two simultaneous requests cannot both succeed, because the database decides.
- Also enforce one active poll per room with a partial unique index (`unique (room_id) where status = 'active'`), and apply the switch (close the old poll, open the new one) in a single transaction.
- Vote counts are computed with a `group by` over `votes`. They are not kept in a separate counter.

## Consequences

Good:

- No race conditions between check and insert, and the rule holds even if application code changes.
- The server has a single source of truth, so results broadcast to everyone are always consistent with what is stored.

Costs and limits:

- Someone who clears their browser storage becomes a new participant and can vote again. Without accounts this cannot be prevented, and it is acceptable for anonymous audience polling.
- The session token is stored as plain text. If it leaks, someone can act as that participant in that room. Hashing the stored token is a possible hardening step.
- Counting with `group by` held up in the load test ([ADR 0004](./0004-throttle-result-broadcasts.md)): even with 5,000 voters in one room the bottleneck was broadcasting, not counting. Redis counters with periodic persistence would only be worth adding if that changes, and they would get their own ADR.

## Alternatives considered

- **Check then insert in application code**: simple, but racy under concurrency.
- **Redis `SETNX` per vote**: fast, but adds a second source of truth that can drift from Postgres.
- **IP or cookie based limits**: shared networks and NAT make IP checks unfair, and cookies are no stronger than a stored token.
