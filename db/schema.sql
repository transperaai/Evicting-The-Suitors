-- Evicting the Suitors — schema
-- "When an impure spirit comes out of a person ... it says, 'I will return to the house I left.'
--  When it arrives, it finds the house unoccupied, swept clean and put in order.
--  Then it goes and takes with it seven other spirits more wicked than itself." (Matthew 12:43-45)
-- So: every suitor you evict must be replaced by an occupant.

create table if not exists suitors (
  id          serial primary key,
  name        text not null,
  kind        text not null default 'habit',      -- habit | loop | fear | lie | sleep | inaction
  weight      int  not null default 3,            -- 1..5: how much of the house it occupies
  status      text not null default 'occupying',  -- occupying | evicting | evicted
  is_root     boolean not null default false,     -- the first domino
  lie         text,                               -- the lie underneath it
  sounds_like text,                               -- what it says in your head
  cost        text,                               -- what it costs you
  notes       text,
  created_at  timestamptz not null default now(),
  evicted_at  timestamptz
);

-- "this suitor feeds that suitor" (the chain / loop)
create table if not exists suitor_links (
  from_id int not null references suitors(id) on delete cascade,
  to_id   int not null references suitors(id) on delete cascade,
  primary key (from_id, to_id)
);

-- How a suitor gets in: what, where (room), when
create table if not exists triggers (
  id          serial primary key,
  suitor_id   int not null references suitors(id) on delete cascade,
  description text not null,
  location    text,
  time_of_day text,
  created_at  timestamptz not null default now()
);

-- The Household: truths (scripture you choose) and practices that occupy the house
create table if not exists occupants (
  id         serial primary key,
  name       text not null,
  kind       text not null default 'practice',  -- truth | practice
  reference  text,                              -- e.g. Psalm 4:8
  content    text,                              -- the verse, or how you'll do it
  rhythm     text not null default 'daily',     -- evening | morning | daily | moment
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Which occupant takes which suitor's place
create table if not exists replacements (
  suitor_id   int not null references suitors(id) on delete cascade,
  occupant_id int not null references occupants(id) on delete cascade,
  primary key (suitor_id, occupant_id)
);

-- Handwritten notes placed in rooms where suitors get in
create table if not exists notes (
  id         serial primary key,
  location   text not null,
  text       text not null,
  suitor_id  int references suitors(id) on delete set null,
  placed_on  date not null default current_date,
  status     text not null default 'planned',   -- planned | placed | removed
  created_at timestamptz not null default now()
);

-- Every time a suitor shows up
create table if not exists encounters (
  id           serial primary key,
  suitor_id    int references suitors(id) on delete cascade,
  location     text,
  trigger_text text,
  intensity    int not null default 3,
  outcome      text not null default 'gave_in',  -- gave_in | redirected | resisted
  note_helped  text,                             -- yes | no | none
  reflection   text,
  occurred_at  timestamptz not null default now()
);

-- The daily rhythm
create table if not exists days (
  day            date primary key,
  slept_at       time,
  woke_at        time,
  bedtime_target time,
  plan1          text,
  plan2          text,
  plan3          text,
  handed_over    text,   -- what's on your mind, written down and handed to God
  gratitude      text,
  reflection     text,
  updated_at     timestamptz not null default now()
);

create table if not exists day_practices (
  day         date not null,
  occupant_id int not null references occupants(id) on delete cascade,
  primary key (day, occupant_id)
);

create index if not exists encounters_occurred_idx on encounters (occurred_at desc);
create index if not exists triggers_suitor_idx on triggers (suitor_id);

-- Who I am: the centre everything else orbits.
-- (Argus knew Odysseus after twenty years, even in disguise.)
create table if not exists settings (
  key   text primary key,
  value text
);
