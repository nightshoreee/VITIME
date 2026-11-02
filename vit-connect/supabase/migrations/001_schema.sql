-- =====================================================================
-- 001_schema.sql : tables, functions, triggers   (run in Supabase SQL editor)
-- =====================================================================

-- ---------- TABLES ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  full_name text not null check (char_length(full_name) between 2 and 80),
  avatar_path text,
  bio text not null default '' check (char_length(bio) <= 300),
  interests text[] not null default '{}' check (cardinality(interests) <= 15),
  show_interests boolean not null default true,
  suspended boolean not null default false,
  notif_prefs jsonb not null default '{"likes":true,"comments":true,"follows":true,"events":true,"messages":true}',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Sensitive fields: readable only by the owner and the admin.
create table public.profile_private (
  id uuid primary key references public.profiles(id) on delete cascade,
  reg_no text not null unique check (reg_no ~ '^[0-9]{2}[A-Z]{3}[0-9]{4}$'),
  gender text not null default 'prefer_not_to_say' check (gender in ('male','female','non_binary','prefer_not_to_say')),
  dob date
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  image_path text not null,
  caption text not null default '' check (char_length(caption) <= 500),
  created_at timestamptz not null default now(),
  check (image_path like user_id::text || '/%')
);
create index posts_user_created_idx on public.posts (user_id, created_at desc);
create index posts_created_idx on public.posts (created_at desc);

create table public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index likes_user_idx on public.likes (user_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following_idx on public.follows (following_id);

create table public.saved_posts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  host_name text not null,
  host_reg_no text not null,
  location text not null check (char_length(location) between 2 and 150),
  description text not null check (char_length(description) between 10 and 500),
  category text not null default 'Other' check (category in ('Tech','Cultural','Sports','Food','Workshop','Market','Fest','Other')),
  event_date date not null,
  start_time time not null,
  end_time time not null,
  registration_deadline timestamptz,
  max_participants int check (max_participants is null or max_participants between 1 and 5000),
  image1_path text not null,
  image2_path text not null,
  conversation_id uuid,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index events_date_idx on public.events (event_date);
create index events_organizer_idx on public.events (organizer_id);

create table public.event_attendees (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_attendees_user_idx on public.event_attendees (user_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  price numeric(10,2) not null check (price >= 0),
  available boolean not null default true,
  order_instructions text not null default '' check (char_length(order_instructions) <= 300),
  created_at timestamptz not null default now()
);
create index products_event_idx on public.products (event_id);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.boost_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_days int not null check (plan_days > 0),
  amount numeric(10,2) not null check (amount > 0),
  reference text not null unique default ('BST-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))),
  payer_utr text check (payer_utr is null or payer_utr ~ '^[0-9A-Za-z]{6,30}$'),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create index boost_event_idx on public.boost_requests (event_id, status, ends_at);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('dm','dating','group','event')),
  title text,
  event_id uuid references public.events(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','request','declined')),
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conv_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_conv_idx on public.messages (conversation_id, created_at desc);

create table public.hangout_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  dating_enabled boolean not null default false,
  friends_enabled boolean not null default false,
  seeking_genders text[] not null default '{}' check (seeking_genders <@ array['male','female','non_binary','prefer_not_to_say']),
  activities text[] not null default '{}' check (activities <@ array['hills','lakes','restaurants','nightouts','cafes','sports','movies','games','other']),
  vibes text[] not null default '{}' check (vibes <@ array['chill','adventurous','foodie','nerdy','party','creative','sporty']),
  availability text[] not null default '{}' check (availability <@ array['weekday_morning','weekday_afternoon','weekday_evening','weekday_night','weekend_morning','weekend_afternoon','weekend_evening','weekend_night']),
  show_bio boolean not null default true,
  show_interests boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.hangout_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('dating','friends')),
  action text not null default 'pending' check (action in ('pending','accepted','rejected','skipped')),
  score int not null default 0,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (user_id, candidate_id, mode),
  check (user_id <> candidate_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('dating','friends')),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (mode, user_a, user_b)
);

create table public.hangout_groups (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  activity text not null default 'other',
  area text not null default '' check (char_length(area) <= 80),  -- general area only, never exact location
  description text not null default '' check (char_length(description) <= 300),
  meet_time timestamptz,
  max_members int not null default 8 check (max_members between 2 and 30),
  conversation_id uuid references public.conversations(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  entity_id uuid,
  data jsonb not null default '{}',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('user','post','event','comment','message','group')),
  target_id uuid not null,
  reason text not null check (reason in ('spam','harassment','inappropriate','fake','safety','other')),
  details text not null default '' check (char_length(details) <= 500),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_by uuid,
  resolved_at timestamptz,
  unique (reporter_id, target_type, target_id)
);
create index reports_status_idx on public.reports (status, created_at desc);

-- Admin audit log (also serves as the moderation-actions table)
create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid,
  action text not null,
  target_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create table public.icebreakers (
  id serial primary key,
  text text not null unique
);

-- ---------- HELPER FUNCTIONS ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from auth.users u
    where u.id = auth.uid() and lower(u.email) = 'nightshoree@gmail.com' and u.email_confirmed_at is not null)
$$;

create or replace function public.is_suspended(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select suspended from public.profiles where id = uid), false)
$$;

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

create or replace function public.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members where conversation_id = cid and user_id = auth.uid() and status <> 'declined')
$$;

create or replace function public.is_active_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members where conversation_id = cid and user_id = auth.uid() and status = 'active')
$$;

create or replace function public.is_event_owner(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events where id = eid and organizer_id = auth.uid())
$$;

create or replace function public.is_boosted(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.boost_requests
    where event_id = eid and status = 'approved' and starts_at <= now() and ends_at > now())
$$;

create or replace function public.check_signup_available(p_username text, p_reg_no text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'username_taken', exists (select 1 from public.profiles where username = lower(p_username)),
    'reg_taken', exists (select 1 from public.profile_private where reg_no = upper(p_reg_no)))
$$;

create or replace function public.notify(p_user uuid, p_actor uuid, p_type text, p_entity uuid, p_data jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare prefs jsonb; k text;
begin
  if p_user is null or p_user = p_actor then return; end if;
  select notif_prefs into prefs from public.profiles where id = p_user;
  k := case p_type when 'like' then 'likes' when 'comment' then 'comments' when 'follow' then 'follows'
                   when 'message' then 'messages' else 'events' end;
  if coalesce((prefs ->> k)::boolean, true) = false then return; end if;
  if p_type = 'message' and exists (select 1 from public.notifications
      where user_id = p_user and type = 'message' and entity_id = p_entity and not read) then return; end if;
  insert into public.notifications (user_id, actor_id, type, entity_id, data) values (p_user, p_actor, p_type, p_entity, p_data);
end $$;

-- Generic abuse limiter: rate_limit(user_column, window, max_rows)
create or replace function public.rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare col text := tg_argv[0]; win interval := tg_argv[1]::interval; mx int := tg_argv[2]::int; n int; uid uuid;
begin
  execute format('select ($1).%I', col) into uid using new;
  execute format('select count(*) from %I.%I where %I = $1 and created_at > now() - $2', tg_table_schema, tg_table_name, col)
    into n using uid, win;
  if n >= mx then raise exception 'RATE_LIMIT: You are doing that too fast. Please wait a moment.'; end if;
  return new;
end $$;

-- ---------- AUTH: DOMAIN ENFORCEMENT + PROFILE CREATION ----------
create or replace function public.enforce_vit_email() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  if lower(new.email) = 'nightshoree@gmail.com' then return new; end if;   -- the only non-student account (admin)
  if lower(coalesce(new.email, '')) !~ '^[a-z0-9._%+-]+@vitstudent\.ac\.in$' then
    raise exception 'Only @vitstudent.ac.in email addresses can register.';
  end if;
  return new;
end $$;

drop trigger if exists enforce_vit_email on auth.users;
create trigger enforce_vit_email before insert or update of email on auth.users
  for each row execute function public.enforce_vit_email();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if lower(new.email) = 'nightshoree@gmail.com' then return new; end if;   -- admin has no student profile
  insert into public.profiles (id, username, full_name)
    values (new.id, lower(trim(m ->> 'username')), trim(m ->> 'full_name'));
  insert into public.profile_private (id, reg_no, gender, dob)
    values (new.id, upper(trim(m ->> 'reg_no')), coalesce(nullif(m ->> 'gender', ''), 'prefer_not_to_say'), nullif(m ->> 'dob', '')::date);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- dob can be set once; it cannot be edited afterwards (protects age checks)
create or replace function public.lock_dob() returns trigger language plpgsql as $$
begin
  if old.dob is not null and new.dob is distinct from old.dob then raise exception 'Date of birth cannot be changed.'; end if;
  new.reg_no := old.reg_no;
  return new;
end $$;
create trigger lock_dob before update on public.profile_private for each row execute function public.lock_dob();

-- ---------- POSTS: 5-POST LIMIT (race-safe) ----------
create or replace function public.enforce_post_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform 1 from public.profiles where id = new.user_id for update;   -- serialises concurrent uploads per user
  select count(*) into n from public.posts where user_id = new.user_id;
  if n >= 5 then raise exception 'POST_LIMIT: Maximum of 5 active posts. Delete one to free a slot.'; end if;
  return new;
end $$;
create trigger posts_limit before insert on public.posts for each row execute function public.enforce_post_limit();
create trigger posts_rate before insert on public.posts for each row execute function public.rate_limit('user_id', '1 hour', '10');
create trigger comments_rate before insert on public.comments for each row execute function public.rate_limit('user_id', '1 minute', '15');
create trigger likes_rate before insert on public.likes for each row execute function public.rate_limit('user_id', '1 minute', '60');
create trigger follows_rate before insert on public.follows for each row execute function public.rate_limit('follower_id', '1 minute', '30');
create trigger messages_rate before insert on public.messages for each row execute function public.rate_limit('sender_id', '1 minute', '30');
create trigger reports_rate before insert on public.reports for each row execute function public.rate_limit('reporter_id', '1 hour', '10');
create trigger events_rate before insert on public.events for each row execute function public.rate_limit('organizer_id', '1 day', '5');

-- ---------- SOCIAL NOTIFICATIONS ----------
create or replace function public.on_like() returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.notify((select user_id from public.posts where id = new.post_id), new.user_id, 'like', new.post_id); return new; end $$;
create trigger likes_notify after insert on public.likes for each row execute function public.on_like();

create or replace function public.on_comment() returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.notify((select user_id from public.posts where id = new.post_id), new.user_id, 'comment', new.post_id, jsonb_build_object('preview', left(new.body, 60))); return new; end $$;
create trigger comments_notify after insert on public.comments for each row execute function public.on_comment();

create or replace function public.on_follow() returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.notify(new.following_id, new.follower_id, 'follow', new.follower_id); return new; end $$;
create trigger follows_notify after insert on public.follows for each row execute function public.on_follow();

-- Blocking removes follows and pending suggestions in both directions
create or replace function public.on_block() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.follows where (follower_id = new.blocker_id and following_id = new.blocked_id) or (follower_id = new.blocked_id and following_id = new.blocker_id);
  delete from public.hangout_suggestions where action = 'pending' and ((user_id = new.blocker_id and candidate_id = new.blocked_id) or (user_id = new.blocked_id and candidate_id = new.blocker_id));
  return new;
end $$;
create trigger blocks_cleanup after insert on public.blocks for each row execute function public.on_block();

-- ---------- EVENTS ----------
create or replace function public.events_before_write() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    select full_name into new.host_name from public.profiles where id = new.organizer_id;
    select reg_no into new.host_reg_no from public.profile_private where id = new.organizer_id;
  else   -- host identity and ownership are immutable
    new.organizer_id := old.organizer_id; new.host_name := old.host_name; new.host_reg_no := old.host_reg_no;
    if old.conversation_id is not null then new.conversation_id := old.conversation_id; end if;
  end if;
  return new;
end $$;
create trigger events_before_write before insert or update on public.events for each row execute function public.events_before_write();

create or replace function public.events_after_insert() returns trigger language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  insert into public.conversations (type, title, event_id, created_by) values ('event', new.title, new.id, new.organizer_id) returning id into cid;
  insert into public.conversation_members (conversation_id, user_id) values (cid, new.organizer_id);
  update public.events set conversation_id = cid where id = new.id;
  return new;
end $$;
create trigger events_after_insert after insert on public.events for each row execute function public.events_after_insert();

create or replace function public.events_after_update() returns trigger language plpgsql security definer set search_path = public as $$
declare a record;
begin
  if new.title is distinct from old.title and new.conversation_id is not null then
    update public.conversations set title = new.title where id = new.conversation_id;
  end if;
  if new.event_date is distinct from old.event_date or new.start_time is distinct from old.start_time
     or new.end_time is distinct from old.end_time or new.location is distinct from old.location then
    for a in select user_id from public.event_attendees where event_id = new.id loop
      perform public.notify(a.user_id, new.organizer_id, 'event_update', new.id, jsonb_build_object('title', new.title));
    end loop;
  end if;
  return new;
end $$;
create trigger events_after_update after update on public.events for each row execute function public.events_after_update();

create or replace function public.attendee_before_insert() returns trigger language plpgsql security definer set search_path = public as $$
declare e public.events; n int;
begin
  select * into e from public.events where id = new.event_id for update;   -- lock => capacity is race-safe
  if not found then raise exception 'Event not found.'; end if;
  if public.is_suspended(new.user_id) then raise exception 'Account suspended.'; end if;
  if ((e.event_date + e.end_time) at time zone 'Asia/Kolkata') < now() then raise exception 'EVENT_COMPLETED: This event has ended.'; end if;
  if e.registration_deadline is not null and now() > e.registration_deadline then raise exception 'DEADLINE_PASSED: Registration has closed.'; end if;
  if e.max_participants is not null then
    select count(*) into n from public.event_attendees where event_id = new.event_id;
    if n >= e.max_participants then raise exception 'EVENT_FULL: This event has reached its participant limit.'; end if;
  end if;
  return new;
end $$;
create trigger attendee_before_insert before insert on public.event_attendees for each row execute function public.attendee_before_insert();

create or replace function public.attendee_after_insert() returns trigger language plpgsql security definer set search_path = public as $$
declare e public.events;
begin
  select * into e from public.events where id = new.event_id;
  if e.conversation_id is not null then
    insert into public.conversation_members (conversation_id, user_id) values (e.conversation_id, new.user_id) on conflict do nothing;
  end if;
  perform public.notify(e.organizer_id, new.user_id, 'event_register', e.id, jsonb_build_object('title', e.title));
  return new;
end $$;
create trigger attendee_after_insert after insert on public.event_attendees for each row execute function public.attendee_after_insert();

create or replace function public.attendee_after_delete() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.conversation_members where user_id = old.user_id
    and conversation_id = (select conversation_id from public.events where id = old.event_id);
  return old;
end $$;
create trigger attendee_after_delete after delete on public.event_attendees for each row execute function public.attendee_after_delete();

create view public.events_feed with (security_invoker = true) as
select e.*,
  public.is_boosted(e.id) as boosted,
  (select count(*) from public.event_attendees a where a.event_id = e.id) as attendee_count,
  (select p.username from public.profiles p where p.id = e.organizer_id) as organizer_username
from public.events e;

-- ---------- BOOSTS ----------
create or replace function public.request_boost(p_event uuid, p_days int) returns public.boost_requests
language plpgsql security definer set search_path = public as $$
declare e public.events; plan jsonb; r public.boost_requests;
begin
  select * into e from public.events where id = p_event;
  if not found or e.organizer_id <> auth.uid() then raise exception 'FORBIDDEN: Only the organizer can boost this event.'; end if;
  if public.is_suspended(auth.uid()) then raise exception 'Account suspended.'; end if;
  if ((e.event_date + e.end_time) at time zone 'Asia/Kolkata') < now() then raise exception 'This event has already ended.'; end if;
  if exists (select 1 from public.boost_requests where event_id = p_event and status = 'pending') then
    raise exception 'You already have a pending boost request for this event.'; end if;
  select x into plan from jsonb_array_elements((select value from public.app_settings where key = 'boost_plans')) x where (x ->> 'days')::int = p_days limit 1;
  if plan is null then raise exception 'Unknown boost plan.'; end if;
  insert into public.boost_requests (event_id, user_id, plan_days, amount) values (p_event, auth.uid(), p_days, (plan ->> 'price')::numeric) returning * into r;
  return r;
end $$;

create or replace function public.admin_review_boost(p_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r public.boost_requests; s timestamptz;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into r from public.boost_requests where id = p_id for update;
  if not found or r.status <> 'pending' then raise exception 'Request not found or already reviewed.'; end if;
  if p_approve then
    select greatest(now(), coalesce(max(ends_at), now())) into s from public.boost_requests where event_id = r.event_id and status = 'approved';
    update public.boost_requests set status = 'approved', reviewed_at = now(), admin_note = p_note, starts_at = s, ends_at = s + make_interval(days => r.plan_days) where id = p_id;
  else
    update public.boost_requests set status = 'rejected', reviewed_at = now(), admin_note = p_note where id = p_id;
  end if;
  insert into public.moderation_actions (admin_id, action, target_id, note) values (auth.uid(), case when p_approve then 'approve_boost' else 'reject_boost' end, p_id, p_note);
  perform public.notify(r.user_id, null, case when p_approve then 'boost_approved' else 'boost_rejected' end, r.event_id, jsonb_build_object('reference', r.reference));
end $$;

create or replace function public.log_settings_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.moderation_actions (admin_id, action, note) values (auth.uid(), 'update_setting:' || new.key, left(new.value::text, 500));
  new.updated_at := now();
  return new;
end $$;
create trigger settings_audit before insert or update on public.app_settings for each row execute function public.log_settings_change();

-- ---------- CHAT ----------
create or replace function public.messages_before_insert() returns trigger language plpgsql security definer set search_path = public as $$
declare c public.conversations; o record; n int;
begin
  select * into c from public.conversations where id = new.conversation_id;
  if not exists (select 1 from public.conversation_members where conversation_id = new.conversation_id and user_id = new.sender_id and status = 'active') then
    raise exception 'NOT_A_MEMBER: You cannot post in this conversation.'; end if;
  if public.is_suspended(new.sender_id) then raise exception 'Account suspended.'; end if;
  if c.type in ('dm', 'dating') then
    for o in select user_id, status from public.conversation_members where conversation_id = c.id and user_id <> new.sender_id loop
      if public.is_blocked_between(new.sender_id, o.user_id) then raise exception 'BLOCKED: You cannot message this user.'; end if;
      if o.status = 'declined' then raise exception 'REQUEST_DECLINED: This user declined your message request.'; end if;
      if o.status = 'request' then
        select count(*) into n from public.messages where conversation_id = c.id and sender_id = new.sender_id;
        if n >= 1 then raise exception 'REQUEST_PENDING: Wait for them to accept your message request.'; end if;
      end if;
    end loop;
  end if;
  return new;
end $$;
create trigger messages_before_insert before insert on public.messages for each row execute function public.messages_before_insert();

create or replace function public.messages_after_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(m.user_id, new.sender_id, 'message', new.conversation_id, jsonb_build_object('preview', left(new.body, 60)))
    from public.conversation_members m join public.conversations c on c.id = m.conversation_id
    where m.conversation_id = new.conversation_id and m.user_id <> new.sender_id and m.status <> 'declined' and c.type in ('dm', 'dating');
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages for each row execute function public.messages_after_insert();

create or replace function public.start_dm(other uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid;
begin
  if me is null then raise exception 'Not authenticated.'; end if;
  if me = other then raise exception 'You cannot message yourself.'; end if;
  if public.is_suspended(me) then raise exception 'Account suspended.'; end if;
  if public.is_suspended(other) or public.is_blocked_between(me, other) then raise exception 'You cannot message this user.'; end if;
  select c.id into cid from public.conversations c
    where c.type = 'dm'
      and exists (select 1 from public.conversation_members m where m.conversation_id = c.id and m.user_id = me)
      and exists (select 1 from public.conversation_members m where m.conversation_id = c.id and m.user_id = other) limit 1;
  if cid is not null then return cid; end if;
  insert into public.conversations (type, created_by) values ('dm', me) returning id into cid;
  insert into public.conversation_members (conversation_id, user_id, status) values
    (cid, me, 'active'),
    (cid, other, case when exists (select 1 from public.follows where follower_id = other and following_id = me) then 'active' else 'request' end);
  return cid;
end $$;

create or replace function public.my_conversations()
returns table (id uuid, type text, title text, event_id uuid, my_status text, last_body text, last_at timestamptz,
               unread bigint, other_id uuid, other_name text, other_username text, other_avatar text)
language sql stable security definer set search_path = public as $$
  select c.id, c.type, c.title, c.event_id, me.status, lm.body, coalesce(lm.created_at, c.created_at),
    (select count(*) from public.messages x where x.conversation_id = c.id and x.sender_id <> auth.uid() and x.created_at > me.last_read_at),
    o.id, o.full_name, o.username, o.avatar_path
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  left join lateral (select body, created_at from public.messages m where m.conversation_id = c.id order by created_at desc limit 1) lm on true
  left join lateral (select p.id, p.full_name, p.username, p.avatar_path from public.conversation_members om
      join public.profiles p on p.id = om.user_id
      where om.conversation_id = c.id and om.user_id <> auth.uid() and c.type in ('dm', 'dating') limit 1) o on true
  where me.user_id = auth.uid() and me.status <> 'declined'
  order by 7 desc
$$;

-- ---------- HANGOUTS ----------
create or replace function public.hangout_before_write() returns trigger language plpgsql security definer set search_path = public as $$
declare d date;
begin
  if new.dating_enabled then
    select dob into d from public.profile_private where id = new.user_id;
    if d is null or d > (current_date - interval '18 years') then
      raise exception 'AGE_RESTRICTED: Dating is only available to verified adults (18+). Add your date of birth in Edit profile.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger hangout_before_write before insert or update on public.hangout_profiles for each row execute function public.hangout_before_write();

create or replace function public.next_hangout_suggestion(p_mode text)
returns table (suggestion_id uuid, candidate_id uuid, full_name text, username text, avatar_path text, bio text,
               interests text[], shared_activities text[], shared_vibes text[], score int)
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mh public.hangout_profiles; mg text; cand uuid; sc int; sid uuid;
begin
  if me is null then raise exception 'Not authenticated.'; end if;
  if public.is_suspended(me) then raise exception 'Account suspended.'; end if;
  if p_mode not in ('dating', 'friends') then raise exception 'Invalid mode.'; end if;
  select * into mh from public.hangout_profiles where user_id = me;
  if not found or not (case when p_mode = 'dating' then mh.dating_enabled else mh.friends_enabled end) then
    raise exception 'NOT_OPTED_IN: Turn this feature on in your preferences first.'; end if;
  select gender into mg from public.profile_private where id = me;

  -- hand back an unanswered suggestion first (page reloads)
  select s.id, s.candidate_id, s.score into sid, cand, sc from public.hangout_suggestions s
    where s.user_id = me and s.mode = p_mode and s.action = 'pending' and not public.is_blocked_between(me, s.candidate_id) limit 1;

  if sid is null then
    select q.uid, q.sc into cand, sc from (
      select h.user_id as uid,
        3 * coalesce(cardinality(array(select unnest(h.activities) intersect select unnest(mh.activities))), 0)
        + 2 * coalesce(cardinality(array(select unnest(h.vibes) intersect select unnest(mh.vibes))), 0)
        + 2 * coalesce(cardinality(array(select unnest(h.availability) intersect select unnest(mh.availability))), 0) as sc
      from public.hangout_profiles h
      join public.profiles p on p.id = h.user_id and not p.suspended
      join public.profile_private pp on pp.id = h.user_id
      where h.user_id <> me
        and (case when p_mode = 'dating' then h.dating_enabled else h.friends_enabled end)
        and (cardinality(mh.seeking_genders) = 0 or pp.gender = any (mh.seeking_genders))
        and (cardinality(h.seeking_genders) = 0 or mg = any (h.seeking_genders))
        and (cardinality(mh.activities) = 0 or cardinality(h.activities) = 0 or h.activities && mh.activities)
        and (cardinality(mh.availability) = 0 or cardinality(h.availability) = 0 or h.availability && mh.availability)
        and (p_mode <> 'dating' or (pp.dob is not null and pp.dob <= current_date - interval '18 years'))
        and not public.is_blocked_between(me, h.user_id)
        and not exists (select 1 from public.hangout_suggestions s where s.user_id = me and s.candidate_id = h.user_id and s.mode = p_mode
              and (s.action in ('pending', 'accepted', 'rejected') or s.responded_at > now() - interval '7 days'))
    ) q order by q.sc + random() * 4 desc limit 1;
    if cand is null then return; end if;
    insert into public.hangout_suggestions (user_id, candidate_id, mode, score) values (me, cand, p_mode, sc)
      on conflict on constraint hangout_suggestions_user_id_candidate_id_mode_key do update set action = 'pending', created_at = now(), responded_at = null, score = excluded.score
      returning id into sid;
  end if;

  return query
    select sid, p.id, p.full_name, p.username, p.avatar_path,
      case when h.show_bio then p.bio else null end,
      case when h.show_interests and p.show_interests then p.interests else '{}'::text[] end,
      array(select unnest(h.activities) intersect select unnest(mh.activities)),
      array(select unnest(h.vibes) intersect select unnest(mh.vibes)),
      sc
    from public.profiles p join public.hangout_profiles h on h.user_id = p.id where p.id = cand;
end $$;

create or replace function public.respond_hangout_suggestion(p_id uuid, p_action text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); s public.hangout_suggestions; rev public.hangout_suggestions; cid uuid; a uuid; b uuid;
begin
  if me is null then raise exception 'Not authenticated.'; end if;
  if p_action not in ('accepted', 'rejected', 'skipped') then raise exception 'Invalid action.'; end if;
  select * into s from public.hangout_suggestions where id = p_id and user_id = me;
  if not found then raise exception 'Suggestion not found.'; end if;
  a := least(s.user_id, s.candidate_id); b := greatest(s.user_id, s.candidate_id);
  perform pg_advisory_xact_lock(hashtext(a::text || b::text || s.mode));   -- prevents a lost mutual-accept race
  select * into s from public.hangout_suggestions where id = p_id;
  if s.action <> 'pending' then raise exception 'You already responded to this suggestion.'; end if;
  if public.is_suspended(me) then raise exception 'Account suspended.'; end if;
  update public.hangout_suggestions set action = p_action, responded_at = now() where id = p_id;
  if p_action = 'accepted' then
    if public.is_blocked_between(me, s.candidate_id) then raise exception 'This user is unavailable.'; end if;
    select * into rev from public.hangout_suggestions where user_id = s.candidate_id and candidate_id = me and mode = s.mode and action = 'accepted';
    if found then
      select conversation_id into cid from public.matches where mode = s.mode and user_a = a and user_b = b;
      if cid is null then
        insert into public.conversations (type, created_by) values (case when s.mode = 'dating' then 'dating' else 'dm' end, me) returning id into cid;
        insert into public.conversation_members (conversation_id, user_id) values (cid, a), (cid, b);
        insert into public.matches (mode, user_a, user_b, conversation_id) values (s.mode, a, b, cid) on conflict do nothing;
        perform public.notify(s.candidate_id, me, 'match', cid, jsonb_build_object('mode', s.mode));
        perform public.notify(me, s.candidate_id, 'match', cid, jsonb_build_object('mode', s.mode));
      end if;
      return jsonb_build_object('matched', true, 'conversation_id', cid, 'mode', s.mode);
    end if;
  end if;
  return jsonb_build_object('matched', false);
end $$;

create or replace function public.create_hangout_group(p_title text, p_activity text, p_area text, p_desc text, p_time timestamptz, p_max int) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid; gid uuid;
begin
  if not exists (select 1 from public.hangout_profiles where user_id = me and friends_enabled) then raise exception 'NOT_OPTED_IN: Enable group hangouts first.'; end if;
  if public.is_suspended(me) then raise exception 'Account suspended.'; end if;
  if (select count(*) from public.hangout_groups where created_by = me and created_at > now() - interval '1 day') >= 3 then raise exception 'RATE_LIMIT: You can create 3 groups per day.'; end if;
  insert into public.conversations (type, title, created_by) values ('group', p_title, me) returning id into cid;
  insert into public.conversation_members (conversation_id, user_id) values (cid, me);
  insert into public.hangout_groups (created_by, title, activity, area, description, meet_time, max_members, conversation_id)
    values (me, p_title, coalesce(p_activity, 'other'), coalesce(p_area, ''), coalesce(p_desc, ''), p_time, coalesce(p_max, 8), cid) returning id into gid;
  return gid;
end $$;

create or replace function public.join_hangout_group(p_group uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); g public.hangout_groups; n int;
begin
  select * into g from public.hangout_groups where id = p_group for update;
  if not found then raise exception 'Group not found.'; end if;
  if not exists (select 1 from public.hangout_profiles where user_id = me and friends_enabled) then raise exception 'NOT_OPTED_IN: Enable group hangouts first.'; end if;
  if public.is_suspended(me) or public.is_blocked_between(me, g.created_by) then raise exception 'You cannot join this group.'; end if;
  select count(*) into n from public.conversation_members where conversation_id = g.conversation_id and status = 'active';
  if n >= g.max_members and not exists (select 1 from public.conversation_members where conversation_id = g.conversation_id and user_id = me) then raise exception 'This group is full.'; end if;
  insert into public.conversation_members (conversation_id, user_id) values (g.conversation_id, me) on conflict do nothing;
  return g.conversation_id;
end $$;

create or replace function public.list_hangout_groups()
returns table (id uuid, title text, activity text, area text, description text, meet_time timestamptz, max_members int,
               conversation_id uuid, created_by uuid, creator_name text, member_count bigint, joined boolean)
language sql stable security definer set search_path = public as $$
  select g.id, g.title, g.activity, g.area, g.description, g.meet_time, g.max_members, g.conversation_id, g.created_by, p.full_name,
    (select count(*) from public.conversation_members m where m.conversation_id = g.conversation_id and m.status = 'active'),
    exists (select 1 from public.conversation_members m where m.conversation_id = g.conversation_id and m.user_id = auth.uid())
  from public.hangout_groups g join public.profiles p on p.id = g.created_by
  where exists (select 1 from public.hangout_profiles h where h.user_id = auth.uid() and h.friends_enabled)
    and not p.suspended and (g.meet_time is null or g.meet_time > now() - interval '1 day')
  order by g.meet_time nulls last, g.created_at desc
$$;

-- ---------- ACCOUNT ----------
create or replace function public.delete_my_account() returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;
  delete from auth.users where id = auth.uid();   -- cascades to every user-owned row
end $$;

-- ---------- ADMIN ----------
create or replace function public.admin_moderate(p_action text, p_target uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  case p_action
    when 'suspend_user' then update public.profiles set suspended = true where id = p_target;
    when 'restore_user' then update public.profiles set suspended = false where id = p_target;
    when 'delete_post' then delete from public.posts where id = p_target;
    when 'delete_event' then delete from public.events where id = p_target;
    when 'delete_comment' then delete from public.comments where id = p_target;
    when 'resolve_report' then update public.reports set status = 'resolved', resolved_by = auth.uid(), resolved_at = now() where id = p_target;
    when 'dismiss_report' then update public.reports set status = 'dismissed', resolved_by = auth.uid(), resolved_at = now() where id = p_target;
    else raise exception 'Unknown action.';
  end case;
  insert into public.moderation_actions (admin_id, action, target_id, note) values (auth.uid(), p_action, p_target, p_note);
end $$;

create or replace function public.admin_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'new_users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'active_users_7d', (select count(*) from public.profiles where last_seen_at > now() - interval '7 days'),
    'suspended', (select count(*) from public.profiles where suspended),
    'posts', (select count(*) from public.posts),
    'posts_7d', (select count(*) from public.posts where created_at > now() - interval '7 days'),
    'events', (select count(*) from public.events),
    'upcoming_events', (select count(*) from public.events where ((event_date + end_time) at time zone 'Asia/Kolkata') >= now()),
    'registrations', (select count(*) from public.event_attendees),
    'likes', (select count(*) from public.likes),
    'comments', (select count(*) from public.comments),
    'follows', (select count(*) from public.follows),
    'messages_7d', (select count(*) from public.messages where created_at > now() - interval '7 days'),
    'hangout_optins', (select count(*) from public.hangout_profiles where dating_enabled or friends_enabled),
    'matches', (select count(*) from public.matches),
    'pending_boosts', (select count(*) from public.boost_requests where status = 'pending'),
    'active_boosts', (select count(*) from public.boost_requests where status = 'approved' and starts_at <= now() and ends_at > now()),
    'revenue', (select coalesce(sum(amount), 0) from public.boost_requests where status = 'approved'),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'signups_by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', to_char(d, 'DD Mon'), 'n', (select count(*) from public.profiles where created_at::date = d)) order by d), '[]')
                       from generate_series(current_date - 13, current_date, interval '1 day') d)
  ) into r;
  return r;
end $$;

create or replace function public.admin_list_users(p_q text default '', p_limit int default 20, p_offset int default 0)
returns table (id uuid, username text, full_name text, reg_no text, suspended boolean, created_at timestamptz, last_seen_at timestamptz,
               posts bigint, followers bigint, following bigint, events_hosted bigint, events_joined bigint, likes_given bigint, comments_made bigint, total bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  return query
  select p.id, p.username, p.full_name, pp.reg_no, p.suspended, p.created_at, p.last_seen_at,
    (select count(*) from public.posts x where x.user_id = p.id),
    (select count(*) from public.follows f where f.following_id = p.id),
    (select count(*) from public.follows f where f.follower_id = p.id),
    (select count(*) from public.events e where e.organizer_id = p.id),
    (select count(*) from public.event_attendees a where a.user_id = p.id),
    (select count(*) from public.likes l where l.user_id = p.id),
    (select count(*) from public.comments c where c.user_id = p.id),
    count(*) over ()
  from public.profiles p join public.profile_private pp on pp.id = p.id
  where coalesce(p_q, '') = '' or p.username ilike '%' || p_q || '%' or p.full_name ilike '%' || p_q || '%' or pp.reg_no ilike '%' || p_q || '%'
  order by p.created_at desc limit least(p_limit, 100) offset p_offset;
end $$;
