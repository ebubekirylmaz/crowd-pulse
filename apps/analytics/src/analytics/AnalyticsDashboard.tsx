import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import {
  Alert,
  Badge,
  Card,
  cx,
  EmptyState,
  Skeleton,
} from "@crowd-pulse/ui";
import { ChartIcon } from "@crowd-pulse/ui";
import TimeSeriesChart from "./TimeSeriesChart";
import type { Metric, Overview, Range, RoomReport } from "./types";

const REFRESH_MS = 60_000;

const RANGES: { value: Range; label: string }[] = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

const METRICS: { value: Metric; label: string }[] = [
  { value: "visitors", label: "Visitors" },
  { value: "events", label: "Events" },
];

const EVENT_LABELS: Record<string, string> = {
  pageview: "Page views",
  join: "Joins",
  vote: "Votes",
  question_ask: "Questions asked",
  question_upvote: "Question upvotes",
  demo_start: "Demo starts",
  poll_create: "Polls created",
};

const eventLabel = (event: string) =>
  EVENT_LABELS[event] ?? event.replace(/_/g, " ");

const format = (value: number) => value.toLocaleString("en-US");

type Props = {
  token: string;
  roomCode?: string;
  onUnauthorized: () => void;
  onSelectRoom?: (code: string) => void;
};

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-slate-100 p-1 text-sm font-medium dark:bg-slate-800"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cx(
            "rounded-lg px-3 py-1.5 transition",
            value === option.value
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Card>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">
        {format(value)}
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((n) => (
          <Card key={n}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-20" />
            <Skeleton className="mt-3 h-3 w-32" />
          </Card>
        ))}
      </div>
      <Card>
        <Skeleton className="h-60 w-full" />
      </Card>
    </div>
  );
}

export default function AnalyticsDashboard({
  token,
  roomCode,
  onUnauthorized,
  onSelectRoom,
}: Props) {
  const [range, setRange] = useState<Range>("7d");
  const [metric, setMetric] = useState<Metric>("visitors");
  const [report, setReport] = useState<Overview | RoomReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setReport(null);
    setError(null);
  }, [roomCode, range]);

  useEffect(() => {
    let cancelled = false;
    const request = roomCode
      ? api.getRoomAnalytics(token, roomCode, range)
      : api.getAnalyticsOverview(token, range);
    request
      .then((next) => {
        if (cancelled) return;
        setReport(next);
        setError(null);
      })
      .catch((failure) => {
        if (cancelled) return;
        if (failure instanceof ApiError && failure.status === 401) {
          onUnauthorized();
          return;
        }
        setError(
          failure instanceof ApiError && failure.status === 404
            ? "Room not found"
            : "Couldn't load analytics, it will retry in a minute",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [token, roomCode, range, tick, onUnauthorized]);

  const title =
    report && "room" in report
      ? report.room.title
      : roomCode
        ? roomCode
        : "Analytics";
  const visitorsHint =
    range === "24h"
      ? "Unique visitors in the last 24 hours"
      : "Unique visitors per day, added up. A person is not tracked across days";
  const maxTopEvent = report
    ? Math.max(1, ...report.topEvents.map((item) => item.events))
    : 1;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            {roomCode
              ? "Traffic and activity for this room"
              : "Traffic and activity across your rooms"}
          </p>
        </div>
        <Segmented
          label="Time range"
          value={range}
          options={RANGES}
          onChange={setRange}
        />
      </div>

      {error && <Alert>{error}</Alert>}

      {!report && !error && <LoadingState />}

      {report && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Visitors"
              value={report.totals.visitors}
              hint={visitorsHint}
            />
            <Stat
              label="Page views"
              value={report.totals.pageviews}
              hint="Pages opened, including in-app navigation"
            />
            <Stat
              label="Events"
              value={report.totals.events}
              hint="Page views plus joins, votes and questions"
            />
          </div>

          <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                {metric === "visitors" ? "Visitors" : "Events"} over time
              </h2>
              <Segmented
                label="Chart metric"
                value={metric}
                options={METRICS}
                onChange={setMetric}
              />
            </div>
            {report.totals.events === 0 ? (
              <EmptyState
                icon={<ChartIcon className="h-6 w-6" />}
                title="No events yet"
                hint="Open one of your rooms or join it from a phone to generate traffic. The numbers refresh every minute."
              />
            ) : (
              <TimeSeriesChart
                points={report.series.points}
                metric={metric}
                granularity={report.series.granularity}
              />
            )}
          </Card>

          <div
            className={cx(
              "grid gap-6",
              "rooms" in report && "lg:grid-cols-[1fr_1.4fr]",
            )}
          >
            <Card className="flex min-w-0 flex-col gap-4">
              <h2 className="text-lg font-semibold">Top events</h2>
              {report.topEvents.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Nothing recorded in this period.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {report.topEvents.map((item) => (
                    <li key={item.event}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium">
                          {eventLabel(item.event)}
                        </span>
                        <span className="tabular-nums text-slate-500 dark:text-slate-400">
                          {format(item.events)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-brand-500 dark:bg-brand-400"
                          style={{ width: `${(item.events / maxTopEvent) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {"rooms" in report && (
              <Card className="flex min-w-0 flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Rooms</h2>
                  {report.rooms.length > 0 && (
                    <Badge>{report.rooms.length}</Badge>
                  )}
                </div>
                {report.rooms.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    You have no rooms yet.
                  </p>
                ) : (
                  <div className="-mx-1 overflow-x-auto">
                    <table className="w-full min-w-[26rem] text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          <th className="px-1 pb-2 font-medium">Room</th>
                          <th className="px-1 pb-2 text-right font-medium">
                            Visitors
                          </th>
                          <th className="px-1 pb-2 text-right font-medium">
                            Page views
                          </th>
                          <th className="px-1 pb-2 text-right font-medium">
                            Events
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.rooms.map((room) => (
                          <tr
                            key={room.code}
                            className="border-t border-slate-100 dark:border-slate-800"
                          >
                            <td className="px-1 py-2">
                              {onSelectRoom ? (
                                <button
                                  type="button"
                                  onClick={() => onSelectRoom(room.code)}
                                  className="text-left font-medium text-brand-700 hover:underline dark:text-brand-300"
                                >
                                  {room.title}
                                </button>
                              ) : (
                                <span className="font-medium">{room.title}</span>
                              )}
                              <span className="ml-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                                {room.code}
                              </span>
                            </td>
                            <td className="px-1 py-2 text-right tabular-nums">
                              {format(room.visitors)}
                            </td>
                            <td className="px-1 py-2 text-right tabular-nums">
                              {format(room.pageviews)}
                            </td>
                            <td className="px-1 py-2 text-right tabular-nums">
                              {format(room.events)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}
          </div>
        </>
      )}
    </section>
  );
}
