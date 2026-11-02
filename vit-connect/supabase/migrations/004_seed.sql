-- =====================================================================
-- 004_seed.sql : default settings + icebreakers.  Edit UPI + prices later in Admin > Payments.
-- =====================================================================
insert into public.app_settings (key, value) values
  ('upi', '{"id":"yourname@upi","name":"Your Name"}'),
  ('boost_plans', '[{"days":1,"price":29},{"days":3,"price":69},{"days":7,"price":129}]')
on conflict (key) do nothing;

insert into public.icebreakers (text) values
 ('What is the one mess item you would defend to the end?'),
 ('Which professor''s class would you attend even if it wasn''t compulsory?'),
 ('What is your go-to order at the late-night canteen?'),
 ('If you could add one course to the curriculum, what would it be?'),
 ('What is the best spot on campus to watch the sunset?'),
 ('What is a skill you picked up in college that has nothing to do with your degree?'),
 ('Which club or event changed how you see college?'),
 ('What song has been on repeat during exam week?'),
 ('If you had a free weekend and ₹500, where would you go?'),
 ('What is your most useful hostel life hack?'),
 ('Hills or lakes: which is the better hangout, and why?'),
 ('What is the most underrated place near campus?'),
 ('What is one thing you wish you had known in first year?'),
 ('Which fest moment are you still talking about?'),
 ('What is your comfort show for a bad-grade day?'),
 ('If your friend group had a podcast, what would it be called?'),
 ('What is the best group project team you have ever been on?'),
 ('Which food item do you think is overpriced on campus?'),
 ('What would you build if you had one free month and no exams?'),
 ('What is a small thing that instantly makes your day better?'),
 ('Which movie would you recommend for a rainy-day marathon?'),
 ('What is your unpopular opinion about campus life?'),
 ('If you could teleport anywhere for dinner tonight, where would it be?'),
 ('What are you learning right now just for fun?'),
 ('What is the best advice a senior has given you?'),
 ('Early morning person or night owl? Defend your answer.'),
 ('What is the one thing you always carry in your bag?'),
 ('Which sport would you try if you knew you wouldn''t be bad at it?'),
 ('What''s a book, podcast or video that you keep recommending?'),
 ('If you could swap lives with someone on campus for a day, who would it be?')
on conflict do nothing;
