create table events (
  id bigint generated always as identity,
  occurred_at timestamptz not null default now(),
  event text not null,
  room_code text,
  path text not null,
  visitor text not null,
  referrer_host text,
  props jsonb not null default '{}'::jsonb,
  primary key (id, occurred_at)
) partition by range (occurred_at);

create index events_room_time_idx on events (room_code, occurred_at);

create table rollup_hourly (
  bucket timestamptz not null,
  room_code text not null default '',
  events integer not null,
  pageviews integer not null,
  visitors integer not null,
  primary key (bucket, room_code)
);

create table rollup_daily (
  day date not null,
  room_code text not null default '',
  events integer not null,
  pageviews integer not null,
  visitors integer not null,
  primary key (day, room_code)
);

create table rollup_events_daily (
  day date not null,
  room_code text not null default '',
  event text not null,
  events integer not null,
  primary key (day, room_code, event)
);
