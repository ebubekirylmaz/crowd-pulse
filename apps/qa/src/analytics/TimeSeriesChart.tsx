import { useEffect, useRef, useState } from "react";
import type { Granularity, Metric, SeriesPoint } from "./types";

const HEIGHT = 240;
const MIN_WIDTH = 280;
const DEFAULT_WIDTH = 640;
const PAD = { top: 12, right: 8, bottom: 28, left: 44 };

export function niceMax(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const fraction = value / magnitude;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * magnitude;
}

function axisLabel(at: string, granularity: Granularity) {
  if (granularity === "day") {
    return new Date(`${at}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }
  return new Date(at).toLocaleTimeString("en-US", { hour: "numeric" });
}

function tooltip(point: SeriesPoint, metric: Metric, granularity: Granularity) {
  const when =
    granularity === "day"
      ? axisLabel(point.at, granularity)
      : new Date(point.at).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
        });
  const label = metric === "visitors" ? "visitors" : "events";
  return `${when}: ${point[metric].toLocaleString("en-US")} ${label}`;
}

export default function TimeSeriesChart({
  points,
  metric,
  granularity,
}: {
  points: SeriesPoint[];
  metric: Metric;
  granularity: Granularity;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    setWidth(Math.max(MIN_WIDTH, Math.floor(element.clientWidth)));
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(MIN_WIDTH, Math.floor(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const values = points.map((point) => point[metric]);
  const peak = Math.max(0, ...values);
  const total = values.reduce((sum, value) => sum + value, 0);
  const max = niceMax(Math.max(1, peak));
  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotWidth / Math.max(points.length, 1);
  const barWidth = Math.max(2, slot * 0.68);
  const ticks = [...new Set([0, 0.5, 1].map((fraction) => Math.round(max * fraction)))];
  const labelIndexes = [
    ...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]),
  ].filter((index) => index >= 0);

  return (
    <div ref={containerRef} className="w-full">
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label={`${metric} over time, ${total.toLocaleString("en-US")} in total, peak ${peak.toLocaleString("en-US")}`}
        className="block"
      >
        {ticks.map((tick) => {
          const y = PAD.top + plotHeight - (tick / max) * plotHeight;
          return (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y}
                y2={y}
                className="stroke-slate-200 dark:stroke-slate-800"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-500 text-[11px] dark:fill-slate-400"
              >
                {tick.toLocaleString("en-US")}
              </text>
            </g>
          );
        })}

        {points.map((point, index) => {
          const value = point[metric];
          const height = value > 0 ? Math.max(2, (value / max) * plotHeight) : 0;
          const x = PAD.left + index * slot + (slot - barWidth) / 2;
          return (
            <rect
              key={point.at}
              x={x}
              y={PAD.top + plotHeight - height}
              width={barWidth}
              height={height}
              rx={Math.min(3, barWidth / 2)}
              className="fill-brand-500 dark:fill-brand-400"
            >
              <title>{tooltip(point, metric, granularity)}</title>
            </rect>
          );
        })}

        {labelIndexes.map((index, position) => {
          const x = PAD.left + index * slot + slot / 2;
          const anchor =
            position === 0 && labelIndexes.length > 1
              ? "start"
              : index === points.length - 1 && labelIndexes.length > 1
                ? "end"
                : "middle";
          return (
            <text
              key={index}
              x={anchor === "start" ? PAD.left : anchor === "end" ? width - PAD.right : x}
              y={HEIGHT - 8}
              textAnchor={anchor}
              className="fill-slate-500 text-[11px] dark:fill-slate-400"
            >
              {axisLabel(points[index].at, granularity)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
