-- =====================================================================
-- security_tests.sql : backend tests for auth, authorization, post limit, event ownership,
-- boost approval and hangout matching.
-- Run in the Supabase SQL editor AFTER the migrations. Everything is rolled back at the end.
-- A failing test raises "TEST FAILED"; passing tests print NOTICE "PASS: ...".
-- =====================================================================
begin;

create function pg_temp.login(uid uuid, em text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', em, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
end $$;

-- ---- fixtures (as postgres) ----
do $$ begin
  begin insert into auth.users (id, email) values (gen_random_uuid(), 'someone@gmail.com');
    raise exception 'TEST FAILED: non-VIT email accepted';
  exception when others then if sqlerrm like 'TEST FAILED%' then raise; end if; raise notice 'PASS: non-VIT email rejected by database trigger'; end;
end $$;

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
 ('00000000-0000-0000-0000-00000000000a', 'alice@vitstudent.ac.in', '{"username":"alice","full_name":"Alice A","reg_no":"22BCE0001","gender":"female","dob":"2002-01-01"}', now()),
 ('00000000-0000-0000-0000-00000000000b', 'bob@vitstudent.ac.in',   '{"username":"bob","full_name":"Bob B","reg_no":"22BCE0002","gender":"male","dob":"2002-01-01"}', now()),
 ('00000000-0000-0000-0000-00000000000c', 'cara@vitstudent.ac.in',  '{"username":"cara","full_name":"Cara C","reg_no":"22BCE0003","gender":"female","dob":"2002-01-01"}', now()),
 ('00000000-0000-0000-0000-00000000000d', 'dan@vitstudent.ac.in',   '{"username":"dan","full_name":"Dan D","reg_no":"22BCE0004","gender":"male","dob":"2002-01-01"}', now()),
 ('00000000-0000-0000-0000-00000000000e', 'eve@vitstudent.ac.in',   '{"username":"eve","full_name":"Eve E","reg_no":"22BCE0005","gender":"female","dob":"2015-01-01"}', now()),
 ('00000000-0000-0000-0000-00000000000f', 'gus@vitstudent.ac.in',   '{"username":"gus","full_name":"Gus G","reg_no":"22BCE0006","gender":"male","dob":"2002-01-01"}', now()),
 ('00000000-0000-0000-0000-000000000010', 'hana@vitstudent.ac.in',  '{"username":"hana","full_name":"Hana H","reg_no":"22BCE0007","gender":"female","dob":"2002-01-01"}', now()),
 ('00000000-0000-0000-0000-0000000000ad', 'nightshoree@gmail.com', '{}', now());

do $$ begin
  begin insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'dup@vitstudent.ac.in', '{"username":"alice","full_name":"Dup","reg_no":"22BCE9999"}');
    raise exception 'TEST FAILED: duplicate username accepted';
  exception when unique_violation then raise notice 'PASS: usernames are unique'; end;
  begin insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'dup2@vitstudent.ac.in', '{"username":"dup2","full_name":"Dup","reg_no":"22BCE0001"}');
    raise exception 'TEST FAILED: duplicate reg no accepted';
  exception when unique_violation then raise notice 'PASS: registration numbers are unique'; end;
end $$;

-- ---- post limit ----
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'alice@vitstudent.ac.in');
do $$ declare i int; pid uuid; begin
  for i in 1..5 loop
    insert into public.posts (user_id, image_path) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a/p' || i || '.jpg');
  end loop;
  begin insert into public.posts (user_id, image_path) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a/p6.jpg');
    raise exception 'TEST FAILED: 6th post accepted';
  exception when others then if sqlerrm like 'TEST FAILED%' then raise; end if; raise notice 'PASS: 6th post rejected (%)', left(sqlerrm, 30); end;
  delete from public.posts where image_path like '%/p1.jpg' returning id into pid;
  insert into public.posts (user_id, image_path) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a/p7.jpg');
  raise notice 'PASS: deleting a post frees a slot';
end $$;
reset role;

-- ---- authorization: bob cannot touch alice's data ----
select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'bob@vitstudent.ac.in');
do $$ declare n int; begin
  update public.posts set caption = 'hacked' where user_id = '00000000-0000-0000-0000-00000000000a'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FAILED: edited another user''s post'; end if;
  delete from public.posts where user_id = '00000000-0000-0000-0000-00000000000a'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FAILED: deleted another user''s post'; end if;
  begin insert into public.posts (user_id, image_path) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a/x.jpg');
    raise exception 'TEST FAILED: posted as another user';
  exception when others then if sqlerrm like 'TEST FAILED%' then raise; end if; end;
  select count(*) into n from public.profile_private; if n <> 1 then raise exception 'TEST FAILED: private profile data visible to others (%)', n; end if;
  begin update public.profiles set suspended = false where id = '00000000-0000-0000-0000-00000000000b'; raise exception 'TEST FAILED: user edited suspended flag';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_stats(); raise exception 'TEST FAILED: non-admin ran admin_stats';
  exception when others then if sqlerrm like 'TEST FAILED%' then raise; end if; end;
  raise notice 'PASS: users cannot read or modify other users'' content, private data or admin functions';
end $$;
reset role;

-- ---- event ownership, auto host fields, capacity ----
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'alice@vitstudent.ac.in');
do $$ declare eid uuid; h text; r text; begin
  insert into public.events (organizer_id, title, host_name, host_reg_no, location, description, event_date, start_time, end_time, max_participants, image1_path, image2_path)
  values ('00000000-0000-0000-0000-00000000000a', 'Hack Night', 'spoofed', 'spoofed', 'Library', 'An all night hackathon for everyone', current_date + 5, '18:00', '22:00', 1,
          '00000000-0000-0000-0000-00000000000a/e1.jpg', '00000000-0000-0000-0000-00000000000a/e2.jpg') returning id, host_name, host_reg_no into eid, h, r;
  if h <> 'Alice A' or r <> '22BCE0001' then raise exception 'TEST FAILED: host fields not auto-populated (% %)', h, r; end if;
  perform set_config('test.event', eid::text, false);
  raise notice 'PASS: host name + registration number auto-populated from profile';
end $$;
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'bob@vitstudent.ac.in');
do $$ declare n int; eid uuid := current_setting('test.event')::uuid; begin
  update public.events set title = 'pwned' where id = eid; get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FAILED: non-owner updated event'; end if;
  delete from public.events where id = eid; get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FAILED: non-owner deleted event'; end if;
  insert into public.event_attendees (event_id, user_id) values (eid, '00000000-0000-0000-0000-00000000000b');
  raise notice 'PASS: only the organizer can edit/delete an event; RSVP works';
end $$;
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000c', 'cara@vitstudent.ac.in');
do $$ declare eid uuid := current_setting('test.event')::uuid; begin
  begin insert into public.event_attendees (event_id, user_id) values (eid, '00000000-0000-0000-0000-00000000000c');
    raise exception 'TEST FAILED: participant limit ignored';
  exception when others then if sqlerrm like 'TEST FAILED%' then raise; end if; raise notice 'PASS: participant limit enforced'; end;
end $$;
reset role;

-- ---- boost approval workflow ----
update public.app_settings set value = '[{"days":1,"price":29},{"days":3,"price":69}]' where key = 'boost_plans';
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'alice@vitstudent.ac.in');
do $$ declare eid uuid := current_setting('test.event')::uuid; r public.boost_requests; begin
  r := public.request_boost(eid, 3);
  if r.amount <> 69 or r.status <> 'pending' then raise exception 'TEST FAILED: boost request wrong (% %)', r.amount, r.status; end if;
  perform set_config('test.boost', r.id::text, false);
  begin update public.boost_requests set status = 'approved', starts_at = now(), ends_at = now() + interval '3 days' where id = r.id;
    raise exception 'TEST FAILED: organizer self-approved boost';
  exception when insufficient_privilege then null; end;
  if public.is_boosted(eid) then raise exception 'TEST FAILED: boost active before payment verification'; end if;
  raise notice 'PASS: boost is pending, server-priced, and cannot be self-approved';
end $$;
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'bob@vitstudent.ac.in');
do $$ begin
  begin perform public.admin_review_boost(current_setting('test.boost')::uuid, true); raise exception 'TEST FAILED: non-admin approved boost';
  exception when others then if sqlerrm like 'TEST FAILED%' then raise; end if; end;
  raise notice 'PASS: non-admin cannot approve boosts';
end $$;
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000ad', 'nightshoree@gmail.com');
do $$ declare eid uuid := current_setting('test.event')::uuid; b boolean; begin
  perform public.admin_review_boost(current_setting('test.boost')::uuid, true, 'verified in bank app');
  select boosted into b from public.events_feed where id = eid;
  if not b then raise exception 'TEST FAILED: approved boost not active'; end if;
  if (select count(*) from public.moderation_actions where action = 'approve_boost') <> 1 then raise exception 'TEST FAILED: audit log missing'; end if;
  raise notice 'PASS: admin approval activates boost and writes audit log';
end $$;
reset role;
update public.boost_requests set ends_at = now() - interval '1 minute', starts_at = now() - interval '4 days';
do $$ begin
  if public.is_boosted(current_setting('test.event')::uuid) then raise exception 'TEST FAILED: expired boost still active'; end if;
  raise notice 'PASS: boost expires automatically';
end $$;

-- ---- hangout matching ----
insert into public.hangout_profiles (user_id, dating_enabled, friends_enabled, seeking_genders, activities, vibes, availability) values
 ('00000000-0000-0000-0000-00000000000a', true, false, '{male}',   '{hills,lakes}', '{chill}', '{weekend_evening}'),
 ('00000000-0000-0000-0000-00000000000b', true, false, '{female}', '{hills}',       '{chill}', '{weekend_evening,weekday_night}'),
 ('00000000-0000-0000-0000-00000000000c', false, true, '{}',       '{hills}',       '{chill}', '{weekend_evening}'),
 ('00000000-0000-0000-0000-00000000000d', true, false, '{male}',   '{hills}',       '{chill}', '{weekend_evening}'),
 ('00000000-0000-0000-0000-00000000000f', true, false, '{female}', '{hills}',       '{}',      '{}'),
 ('00000000-0000-0000-0000-000000000010', true, false, '{male}',   '{hills}',       '{}',      '{}');
do $$ begin
  begin insert into public.hangout_profiles (user_id, dating_enabled) values ('00000000-0000-0000-0000-00000000000e', true);
    raise exception 'TEST FAILED: minor enabled dating';
  exception when others then if sqlerrm like 'TEST FAILED%' then raise; end if; raise notice 'PASS: minors cannot enable dating'; end;
end $$;

select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'alice@vitstudent.ac.in');
do $$ declare s record; n int; begin
  select * into s from public.next_hangout_suggestion('dating');
  if s.candidate_id is distinct from '00000000-0000-0000-0000-00000000000b'::uuid then
    raise exception 'TEST FAILED: expected bob (only mutually compatible opted-in user), got %', s.username; end if;
  perform set_config('test.sugg_a', s.suggestion_id::text, false);
  raise notice 'PASS: only opted-in, mutually gender/activity/availability-compatible users are suggested (not cara/dan/eve)';
end $$;
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'bob@vitstudent.ac.in');
do $$ declare s record; res jsonb; begin
  select * into s from public.next_hangout_suggestion('dating');
  if s.candidate_id is distinct from '00000000-0000-0000-0000-00000000000a'::uuid then raise exception 'TEST FAILED: bob should see alice'; end if;
  res := public.respond_hangout_suggestion(s.suggestion_id, 'accepted');
  if (res ->> 'matched')::boolean then raise exception 'TEST FAILED: matched without mutual acceptance'; end if;
  perform set_config('test.conv_check', 'pending', false);
  raise notice 'PASS: one-sided acceptance does not create a match';
end $$;
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'alice@vitstudent.ac.in');
do $$ declare res jsonb; begin
  res := public.respond_hangout_suggestion(current_setting('test.sugg_a')::uuid, 'accepted');
  if not (res ->> 'matched')::boolean then raise exception 'TEST FAILED: mutual acceptance did not match'; end if;
  if (select type from public.conversations where id = (res ->> 'conversation_id')::uuid) <> 'dating' then raise exception 'TEST FAILED: wrong conversation type'; end if;
  perform set_config('test.conv', res ->> 'conversation_id', false);
  insert into public.messages (conversation_id, sender_id, body) values ((res ->> 'conversation_id')::uuid, '00000000-0000-0000-0000-00000000000a', 'hey!');
  raise notice 'PASS: mutual acceptance creates a dating match + private conversation';
end $$;
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000c', 'cara@vitstudent.ac.in');
do $$ declare n int; begin
  select count(*) into n from public.messages where conversation_id = current_setting('test.conv')::uuid;
  if n <> 0 then raise exception 'TEST FAILED: outsider can read private conversation'; end if;
  begin insert into public.messages (conversation_id, sender_id, body) values (current_setting('test.conv')::uuid, '00000000-0000-0000-0000-00000000000c', 'hi');
    raise exception 'TEST FAILED: outsider posted into conversation';
  exception when others then if sqlerrm like 'TEST FAILED%' then raise; end if; end;
  raise notice 'PASS: non-members cannot read or write conversations';
end $$;
reset role;

-- repeated suggestion + blocking (take the other opted-in users out of the pool so only hana is a candidate for gus)
update public.hangout_profiles set dating_enabled = false where user_id in ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000000d');
select pg_temp.login('00000000-0000-0000-0000-00000000000f', 'gus@vitstudent.ac.in');
do $$ declare s record; begin
  select * into s from public.next_hangout_suggestion('dating');
  if s.candidate_id is distinct from '00000000-0000-0000-0000-000000000010'::uuid then raise exception 'TEST FAILED: gus should see hana'; end if;
  perform public.respond_hangout_suggestion(s.suggestion_id, 'skipped');
  if exists (select 1 from public.next_hangout_suggestion('dating') x where x.candidate_id = '00000000-0000-0000-0000-000000000010') then raise exception 'TEST FAILED: skipped user suggested again immediately'; end if;
  raise notice 'PASS: skipped users are not suggested repeatedly';
end $$;
reset role;
update public.hangout_suggestions set responded_at = now() - interval '30 days' where user_id = '00000000-0000-0000-0000-00000000000f';
select pg_temp.login('00000000-0000-0000-0000-000000000010', 'hana@vitstudent.ac.in');
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-00000000000f');
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000f', 'gus@vitstudent.ac.in');
do $$ begin
  if exists (select 1 from public.next_hangout_suggestion('dating') x where x.candidate_id = '00000000-0000-0000-0000-000000000010') then raise exception 'TEST FAILED: blocked user matched'; end if;
  raise notice 'PASS: users who blocked each other are never matched';
end $$;
reset role;

-- ---- message requests ----
select pg_temp.login('00000000-0000-0000-0000-00000000000d', 'dan@vitstudent.ac.in');
do $$ declare c uuid; begin
  c := public.start_dm('00000000-0000-0000-0000-00000000000c');
  insert into public.messages (conversation_id, sender_id, body) values (c, '00000000-0000-0000-0000-00000000000d', 'hello');
  begin insert into public.messages (conversation_id, sender_id, body) values (c, '00000000-0000-0000-0000-00000000000d', 'hello again');
    raise exception 'TEST FAILED: second message before acceptance';
  exception when others then if sqlerrm like 'TEST FAILED%' then raise; end if; end;
  raise notice 'PASS: message requests limit unsolicited contact to one message';
end $$;
reset role;

rollback;
