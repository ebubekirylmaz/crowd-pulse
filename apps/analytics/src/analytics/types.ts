export type Range = "24h" | "7d" | "30d";
export type Metric = "visitors" | "events";
export type Granularity = "hour" | "day";

export type SeriesPoint = { at: string; events: number; visitors: number };
export type Totals = { events: number; pageviews: number; visitors: number };
export type TopEvent = { event: string; events: number };
export type RoomTotals = Totals & { code: string; title: string };

export type Report = {
  range: Range;
  totals: Totals;
  series: { granularity: Granularity; points: SeriesPoint[] };
  topEvents: TopEvent[];
};

export type Overview = Report & { rooms: RoomTotals[] };
export type RoomReport = Report & { room: { code: string; title: string } };
