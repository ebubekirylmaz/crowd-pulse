export type AppEvents = {
  "demo:started": Record<string, never>;
  "room:joined": Record<string, never>;
  "poll:created": { options: number };
  "poll:voted": Record<string, never>;
  "question:asked": { anonymous: boolean };
  "question:upvoted": Record<string, never>;
};

export type EventName = keyof AppEvents;

export type AnyEvent = {
  [K in EventName]: { name: K; detail: AppEvents[K] };
}[EventName];

const CHANNEL = "__cpEventBus";
const PREFIX = "cp:app:";

type Scope = typeof globalThis & { [CHANNEL]?: EventTarget };

function bus(): EventTarget {
  const scope = globalThis as Scope;
  scope[CHANNEL] ??= new EventTarget();
  return scope[CHANNEL];
}

export function emit<K extends EventName>(name: K, detail: AppEvents[K]) {
  bus().dispatchEvent(new CustomEvent(PREFIX + name, { detail }));
}

export function on<K extends EventName>(
  name: K,
  handler: (detail: AppEvents[K]) => void,
) {
  const listener = (event: Event) =>
    handler((event as CustomEvent<AppEvents[K]>).detail);
  bus().addEventListener(PREFIX + name, listener);
  return () => bus().removeEventListener(PREFIX + name, listener);
}

const NAMES: EventName[] = [
  "demo:started",
  "room:joined",
  "poll:created",
  "poll:voted",
  "question:asked",
  "question:upvoted",
];

export function onAny(handler: (event: AnyEvent) => void) {
  const stops = NAMES.map((name) =>
    on(name, (detail) => handler({ name, detail } as AnyEvent)),
  );
  return () => stops.forEach((stop) => stop());
}
