# 0006: Count visitors without cookies, with a hash that rotates every day

Status: accepted

## Context

The dashboard shows unique visitors. The usual way to get them is a cookie or local storage id, which follows a person across days and needs a consent banner in much of the world. The goal here is the opposite: useful numbers, nothing stored on the visitor's device, and nothing in the database that identifies a person or can be tied to one later.

## Decision

- The snippet sets **no cookies and never touches local or session storage**. It sends events with `sendBeacon`.
- The server derives a visitor id per request: `HMAC-SHA256(daily salt, "ip|user-agent")`, truncated to 32 hex characters. The **IP address and user agent are never stored**, only the hash.
- The **daily salt** is `HMAC(secret, "YYYY-MM-DD")`, where the secret comes from `ANALYTICS_SECRET` (or is derived from `JWT_SECRET`). A new day means a new salt, so the same person gets a different id every day and yesterday's ids cannot be linked to today's, even by someone holding the database.
- Requests with **Do Not Track** or **Global Privacy Control** are accepted and dropped without storing anything. Known bots are dropped the same way.
- Visitors are counted exactly per day. Longer ranges **add up daily uniques** and the card says so.
- Event properties are limited to ten short keys with plain values, and the snippet never sends form content, only the event name, path, an optional room code and a referrer host.

## Consequences

- No consent banner is needed for the snippet's own data, because nothing is stored on the device and nothing identifying is stored on the server.
- Accuracy has known limits, and they are accepted. Two people behind the same address with the same browser count as one. One person on mobile data whose address changes during the day counts as several. Someone who comes back on another day counts again. For a room or an event page those errors are small and the direction is predictable (slightly under or over by a few percent), which is fine for trend and comparison.
- The seven and 30 day visitor numbers are "visitor days", not people. This is shown in the interface so nobody reads them as monthly unique people.
- The cost of the hash is one HMAC per request, which is invisible in the ingest measurements.
- Rotating the secret invalidates nothing stored, because only the hash of the day is kept.

## Alternatives considered

- **First-party cookie with a random id**: accurate across days and sessions, but it is exactly the tracking this project is trying not to do and it brings the consent requirement back.
- **Fingerprinting the browser** (canvas, fonts and so on): stable across days, which is the problem, and indistinguishable from the tracking people block.
- **A hash without a rotating salt**: stable, therefore linkable across days, and a plain hash of an IP can be reversed by trying every address.
- **Not counting visitors at all**: page views alone overstate reach when one person refreshes. A rough, honest unique count is more useful than none.
