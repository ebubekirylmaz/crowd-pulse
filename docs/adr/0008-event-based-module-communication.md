# 0008: Modules talk through typed events, not through each other's code or a global store

Status: accepted

## Context

After the split into a shell and two remotes (ADR 0007), the Q&A module still reported its own analytics: six places called `window.cp.track(...)` directly. That tied it to the analytics snippet, and the tracking only worked because both modules happened to live in the same page. The README also promised event-based shared state between modules, which did not exist.

Two other ways to share state were considered and rejected for this case (see below). What the modules actually need to share is not state at all but facts that happened: a vote was cast, a question was asked.

## Decision

- A tiny package, **`@crowd-pulse/events`**, defines a typed map of domain events (`poll:voted`, `question:asked` with `{ anonymous }`, `poll:created` with `{ options }`, `room:joined`, `question:upvoted`, `demo:started`) and three functions: `emit`, `on` and `onAny`.
- The bus is one `EventTarget` stored on `globalThis`. Each module bundles its own copy of the package, but they all find the same target, so a module deployed on its own can still talk to the others. There is no shared singleton module to configure in Module Federation.
- The Q&A module **only emits domain events**. It does not know analytics exists.
- An **analytics bridge** subscribes to every event and forwards it to the snippet under the names the dashboard already uses (`vote`, `question_ask` and so on), so historical data stays comparable. The shell connects it at start-up, and the Q&A app does the same when it runs on its own. Connecting twice does nothing.
- The event names and payloads are checked by TypeScript in every module that imports the package. At runtime, anything that is not listed is simply never delivered.

## Consequences

- The Q&A module has no reference to the analytics snippet or its API. Replacing the collector, or adding a second consumer such as a live activity indicator, means writing one more listener and changing nothing in Q&A.
- An end-to-end test casts a vote as a participant and checks that the host's analytics report contains one `vote`. Disabling the bridge makes that test fail, which was checked on purpose.
- The bus is fire and forget. A listener that is not mounted when an event happens misses it, so it is for notifications of things that happened, not for state a module needs when it starts. Current values such as the host token still arrive as props.
- The type map is a contract: adding or changing an event is a change in one package that every module sees at build time. Modules deployed at different times can disagree on a payload until they are all rebuilt, which is the same cost as any shared contract.
- Tests exposed a trap worth remembering: the collector drops requests from user agents containing "headless" as bots, so end-to-end runs must present a normal browser identity.

## Alternatives considered

- **A shared global store** (Redux, Zustand or a context provided by the shell): fine for state with one owner, but it makes every module depend on the store's shape and on the shell providing it, and a standalone module would need its own stand-in.
- **Callback props only**: already used for things the shell controls (token, `onUnauthorized`, `onSelectRoom`). Passing "a vote happened" up to a consumer would route every module's facts through the shell.
- **`postMessage` or `BroadcastChannel`**: built for separate windows or origins. All modules share one page here, and these add serialization and async delivery for nothing.
- **Keeping direct `window.cp.track` calls**: simplest, and the reason for this change.
