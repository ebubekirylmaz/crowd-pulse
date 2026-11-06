alter table questions add column answered_at timestamptz;
alter table questions add column anonymous boolean not null default false;
