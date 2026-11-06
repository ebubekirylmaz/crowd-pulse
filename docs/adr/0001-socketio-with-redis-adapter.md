# 0001: Socket.IO with a Redis adapter for realtime fan-out

Status: accepted

## Context

Hosts and participants need to see votes, questions and poll state changes without refreshing. Participants join from phones on unreliable networks, so dropped connections are normal. The API will eventually run as more than one process, and a broadcast made on one process must reach sockets connected to the others.

## Decision

- Use **Socket.IO** on top of the same HTTP server as Fastify.
- Group sockets into one room per Crowd Pulse room (`room:<id>`) and broadcast with `io.to(room).emit(...)`.
- Use **acknowledgements** for participant actions (`vote:cast`, `question:ask`, `question:upvote`) so the client gets a typed success or error reply, instead of inventing a separate response event.
- Authenticate in the connection handshake: participants send a session token, hosts send their JWT plus the room code, and the server checks the host owns that room. The room and participant ids always come from the authenticated socket, never from event payloads.
- Add the **Redis adapter** (`@socket.io/redis-adapter`) with dedicated publisher and subscriber connections, so any instance can broadcast to every socket in a room. This is covered by tests that run two API instances against the same Redis.

## Consequences

Good:

- Reconnection, heartbeats, rooms and acknowledgements come built in, which removes a lot of code compared to raw WebSockets.
- Scaling out is a configuration question, not a rewrite.

Costs and limits:

- Redis becomes part of the realtime path. If it is unreachable, broadcasts only reach sockets on the same instance.
- Socket.IO starts with HTTP long polling and then upgrades. Behind a load balancer with several instances, polling requests must reach the same instance (sticky sessions), or clients must be forced to the `websocket` transport. With a single instance this does not matter.
- The adapter publishes every broadcast through Redis, which adds a small hop. The load test in the README measures the end-to-end effect, and [ADR 0004](./0004-throttle-result-broadcasts.md) covers how result broadcasts are throttled so that fan-out stays cheap.

## Alternatives considered

- **Raw WebSockets (`ws`)**: less overhead, but rooms, reconnection and acknowledgements would all be hand-written.
- **Server-Sent Events**: simple and proxy friendly, but one-way. Votes and questions would still need a separate request channel.
- **Polling**: easiest to build, but it makes results feel laggy and multiplies requests with the audience size.
