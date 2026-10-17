-- hosts
create table hosts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- rooms
create table rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  code text not null unique,
  title text not null,
  created_at timestamptz not null default now()
);

-- participants
create table participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  display_name text not null,
  session_token text not null unique,
  created_at timestamptz not null default now()
);

-- polls
create table polls (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  question text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  created_at timestamptz not null default now()
);

-- poll_options
create table poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid references polls(id) on delete cascade,
  label text not null,
  position int not null
);

-- votes
create table votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid references polls(id) on delete cascade,
  option_id uuid references poll_options(id) on delete cascade,
  participant_id uuid references participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, participant_id)
);

-- questions
create table questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  participant_id uuid references participants(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- question_upvotes
create table question_upvotes (
  question_id uuid references questions(id) on delete cascade,
  participant_id uuid references participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (question_id, participant_id)
);