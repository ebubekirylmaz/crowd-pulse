import "./index.css";

import { connectAnalytics } from "@crowd-pulse/events";
import App from "./App.tsx";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { loadAnalytics } from "./lib/analytics";

loadAnalytics();
connectAnalytics();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
