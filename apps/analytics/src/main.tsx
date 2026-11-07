import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Dashboard from "./Dashboard";

const token = (() => {
  try {
    return localStorage.getItem("cp:host-token") ?? "";
  } catch {
    return "";
  }
})();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Dashboard
        token={token}
        onUnauthorized={() => console.warn("token rejected")}
      />
    </main>
  </StrictMode>,
);
