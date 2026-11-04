-- ADR-26: a second named test account. Remove before real launch.
insert into public.allowed_test_emails (email, note) values ('anushka1222112@gmail.com', 'test student account') on conflict (email) do nothing;
