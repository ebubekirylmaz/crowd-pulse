import { useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeftIcon,
  buttonStyles,
  Logo,
  TopBar,
} from "@crowd-pulse/ui";
import RemoteBoundary from "./RemoteBoundary.tsx";
import { clearToken, loadToken } from "./hostAuth.ts";
import { usePageTitle } from "./usePageTitle.ts";

export default function AnalyticsPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const token = loadToken() ?? "";
  const roomCode = code?.toUpperCase();
  usePageTitle(roomCode ? `Analytics ${roomCode}` : "Analytics");

  const expire = useCallback(() => {
    clearToken();
    navigate("/host/login", { replace: true });
  }, [navigate]);

  const selectRoom = useCallback(
    (selected: string) => navigate(`/host/analytics/${selected}`),
    [navigate],
  );

  return (
    <div className="min-h-dvh">
      <TopBar
        size="lg"
        left={<Logo to="/host" />}
        right={
          <Link
            to="/host"
            className={buttonStyles({ variant: "ghost", size: "sm" })}
          >
            My rooms
          </Link>
        }
      />
      <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8">
        {roomCode && (
          <Link
            to="/host/analytics"
            className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            <ArrowLeftIcon />
            All rooms
          </Link>
        )}
        <RemoteBoundary
          name="Analytics"
          load={() => import("analytics/Dashboard")}
          props={{
            token,
            roomCode,
            onUnauthorized: expire,
            onSelectRoom: selectRoom,
          }}
        />
      </main>
    </div>
  );
}
