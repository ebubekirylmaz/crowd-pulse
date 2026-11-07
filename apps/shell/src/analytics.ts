import { API_URL } from "./config";

const ROOM_PATTERN = "^/(?:join|r|host/rooms)/([A-Za-z0-9]{4,12})";

export function loadAnalytics() {
  const script = document.createElement("script");
  script.src = "/cp.js";
  script.async = true;
  script.dataset.endpoint = `${API_URL}/collect`;
  script.dataset.roomRegex = ROOM_PATTERN;
  document.head.append(script);
}
