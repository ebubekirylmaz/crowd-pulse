import "./index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { connectAnalytics } from "@crowd-pulse/events";
import App from "./App.tsx";
import { loadAnalytics } from "./analytics.ts";

loadAnalytics();
connectAnalytics();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
