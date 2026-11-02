-- =====================================================================
-- 002_rls.sql : privileges, Row Level Security, realtime
-- =====================================================================

-- Nothing is reachable anonymously.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Column-level write restrictions (RLS still applies on top)
revoke insert, delete on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update (username, full_name, avatar_path, bio, interests, show_interests, notif_prefs, last_seen_at) on public.profiles to authenticated;
revoke insert, delete on public.profile_private from authenticated;
revoke update on public.profile_private from authenticated;
grant update (gender, dob) on public.profile_private to authenticated;
revoke update on public.posts from authenticated;
grant update (caption) on public.posts to authenticated;
revoke update on public.comments from authenticated;
revoke update on public.likes, public.follows, public.saved_posts, public.event_attendees, public.blocks from authenticated;
revoke insert, update, delete on public.boost_requests from authenticated;
grant update (payer_utr) on public.boost_requests to authenticated;
revoke insert, update, delete on public.conversations from authenticated;
revoke insert, update, delete on public.conversation_members from authenticated;
grant update (status, last_read_at) on public.conversation_members to authenticated;
grant delete on public.conversation_members to authenticated;
revoke insert, update, delete on public.hangout_suggestions, public.matches from authenticated;
revoke all on public.hangout_groups from authenticated;
revoke insert, update, delete on public.moderation_actions from authenticated;
revoke insert, update, delete on public.icebreakers from authenticated;
revoke update on public.notifications from authenticated;
grant update (read) on public.notifications to authenticated;
revoke update on public.reports from authenticated;

-- Functions: authenticated users only (signup availability check is the one anon exception)
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.notify(uuid, uuid, text, uuid, jsonb) from authenticated;
grant execute on function public.check_signup_available(text, text) to anon, authenticated;

-- ---------- Enable RLS everywhere ----------
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.blocks enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.saved_posts enable row level security;
alter table public.events enable row level security;
alter table public.event_attendees enable row level security;
alter table public.products enable row level security;
alter table public.app_settings enable row level security;
alter table public.boost_requests enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.hangout_profiles enable row level security;
alter table public.hangout_suggestions enable row level security;
alter table public.matches enable row level security;
alter table public.hangout_groups enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.icebreakers enable row level security;

-- ---------- profiles ----------
create policy profiles_select on public.profiles for select to authenticated
  using (not suspended or id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------- profile_private (owner + admin only) ----------
create policy pp_select on public.profile_private for select to authenticated using (id = auth.uid() or public.is_admin());
create policy pp_update_own on public.profile_private for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------- blocks ----------
create policy blocks_select on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy blocks_insert on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy blocks_delete on public.blocks for delete to authenticated using (blocker_id = auth.uid());

-- ---------- posts ----------
create policy posts_select on public.posts for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or not public.is_suspended(user_id));
create policy posts_insert on public.posts for insert to authenticated
  with check (user_id = auth.uid() and not public.is_suspended(auth.uid()));
create policy posts_update on public.posts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy posts_delete on public.posts for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---------- likes / comments / follows / saved ----------
create policy likes_select on public.likes for select to authenticated using (true);
create policy likes_insert on public.likes for insert to authenticated with check (user_id = auth.uid() and not public.is_suspended(auth.uid()));
create policy likes_delete on public.likes for delete to authenticated using (user_id = auth.uid());

create policy comments_select on public.comments for select to authenticated using (true);
create policy comments_insert on public.comments for insert to authenticated with check (user_id = auth.uid() and not public.is_suspended(auth.uid()));
create policy comments_delete on public.comments for delete to authenticated
  using (user_id = auth.uid() or public.is_admin() or exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid()));

create policy follows_select on public.follows for select to authenticated using (true);
create policy follows_insert on public.follows for insert to authenticated
  with check (follower_id = auth.uid() and not public.is_suspended(auth.uid()) and not public.is_blocked_between(follower_id, following_id));
create policy follows_delete on public.follows for delete to authenticated using (follower_id = auth.uid());

create policy saved_all on public.saved_posts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- events / attendees / products ----------
create policy events_select on public.events for select to authenticated
  using (organizer_id = auth.uid() or public.is_admin() or not public.is_suspended(organizer_id));
create policy events_insert on public.events for insert to authenticated
  with check (organizer_id = auth.uid() and not public.is_suspended(auth.uid()));
create policy events_update on public.events for update to authenticated using (organizer_id = auth.uid()) with check (organizer_id = auth.uid());
create policy events_delete on public.events for delete to authenticated using (organizer_id = auth.uid() or public.is_admin());

create policy attendees_select on public.event_attendees for select to authenticated using (true);
create policy attendees_insert on public.event_attendees for insert to authenticated with check (user_id = auth.uid());
create policy attendees_delete on public.event_attendees for delete to authenticated using (user_id = auth.uid() or public.is_event_owner(event_id));

create policy products_select on public.products for select to authenticated using (true);
create policy products_insert on public.products for insert to authenticated with check (public.is_event_owner(event_id));
create policy products_update on public.products for update to authenticated using (public.is_event_owner(event_id)) with check (public.is_event_owner(event_id));
create policy products_delete on public.products for delete to authenticated using (public.is_event_owner(event_id) or public.is_admin());

-- ---------- settings (UPI + pricing) ----------
create policy settings_select on public.app_settings for select to authenticated using (true);
create policy settings_admin_write on public.app_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- boost requests ----------
create policy boost_select on public.boost_requests for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy boost_update_utr on public.boost_requests for update to authenticated
  using (user_id = auth.uid() and status = 'pending') with check (user_id = auth.uid() and status = 'pending');

-- ---------- chat ----------
create policy conv_select on public.conversations for select to authenticated using (public.is_member(id));
create policy members_select on public.conversation_members for select to authenticated using (public.is_member(conversation_id));
create policy members_update_self on public.conversation_members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy members_leave on public.conversation_members for delete to authenticated using (user_id = auth.uid());
create policy messages_select on public.messages for select to authenticated using (public.is_member(conversation_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_active_member(conversation_id));
create policy messages_delete_own on public.messages for delete to authenticated using (sender_id = auth.uid());

-- ---------- hangouts ----------
create policy hp_own on public.hangout_profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy hs_select on public.hangout_suggestions for select to authenticated using (user_id = auth.uid());
create policy matches_select on public.matches for select to authenticated using (auth.uid() in (user_a, user_b));

-- ---------- notifications ----------
create policy notif_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

-- ---------- reports / audit / icebreakers ----------
create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_select on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy audit_select on public.moderation_actions for select to authenticated using (public.is_admin());
create policy icebreakers_select on public.icebreakers for select to authenticated using (true);

-- ---------- realtime ----------
alter publication supabase_realtime add table public.messages, public.notifications;
