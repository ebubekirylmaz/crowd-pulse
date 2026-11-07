import { API_URL } from "../api";

type EventProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    cp?: { track: (name: string, props?: EventProps) => void };
  }
}

const ROOM_PATTERN = "^/(?:join|r|host/rooms)/([A-Za-z0-9]{4,12})";

export function loadAnalytics() {
  const script = document.createElement("script");
  script.src = "/cp.js";
  script.async = true;
  script.dataset.endpoint = `${API_URL}/collect`;
  script.dataset.roomRegex = ROOM_PATTERN;
  document.head.append(script);
}

export function track(name: string, props?: EventProps) {
  window.cp?.track(name, props);
}
