declare module "qa/Routes" {
  import type { ComponentType } from "react";
  const Routes: ComponentType;
  export default Routes;
}

declare module "analytics/Dashboard" {
  import type { ComponentType } from "react";
  const Dashboard: ComponentType<{
    token: string;
    roomCode?: string;
    onUnauthorized: () => void;
    onSelectRoom?: (code: string) => void;
  }>;
  export default Dashboard;
}
