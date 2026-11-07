import { onAny, type AnyEvent } from "./events.ts";

type Track = (name: string, props?: Record<string, string | number | boolean>) => void;

const SNIPPET_NAMES = {
  "demo:started": "demo_start",
  "room:joined": "join",
  "poll:created": "poll_create",
  "poll:voted": "vote",
  "question:asked": "question_ask",
  "question:upvoted": "question_upvote",
} as const;

export function toAnalytics(event: AnyEvent) {
  const props = Object.keys(event.detail).length > 0 ? event.detail : undefined;
  return { name: SNIPPET_NAMES[event.name], props };
}

const GUARD = "__cpAnalyticsBridge";

type Scope = typeof globalThis & {
  cp?: { track: Track };
  [GUARD]?: () => void;
};

export function connectAnalytics() {
  const scope = globalThis as Scope;
  if (scope[GUARD]) return scope[GUARD];
  const stop = onAny((event) => {
    const { name, props } = toAnalytics(event);
    scope.cp?.track(name, props as Record<string, string | number | boolean> | undefined);
  });
  const disconnect = () => {
    stop();
    delete scope[GUARD];
  };
  scope[GUARD] = disconnect;
  return disconnect;
}
