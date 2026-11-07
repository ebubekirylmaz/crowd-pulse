import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AnalyticsPage from "./AnalyticsPage.tsx";
import RemoteBoundary from "./RemoteBoundary.tsx";
import { loadToken } from "./hostAuth.ts";
import type { ReactNode } from "react";

function RequireHost({ children }: { children: ReactNode }) {
  if (!loadToken()) {
    return <Navigate to="/host/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/host/analytics"
          element={
            <RequireHost>
              <AnalyticsPage />
            </RequireHost>
          }
        />
        <Route
          path="/host/analytics/:code"
          element={
            <RequireHost>
              <AnalyticsPage />
            </RequireHost>
          }
        />
        <Route
          path="/*"
          element={
            <RemoteBoundary
              name="Q&A"
              load={() => import("qa/Routes")}
              props={{}}
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
