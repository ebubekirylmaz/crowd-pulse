import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { loadToken } from "../hostAuth";

export default function RequireHost({ children }: { children: ReactNode }) {
  if (!loadToken()) {
    return <Navigate to="/host/login" replace />;
  }
  return <>{children}</>;
}
