-- Admin access now needs BOTH a confirmed email AND profiles.is_admin = true
-- (audit 2026-10-09). Being on the admin email list is no longer enough.
--
-- RUN BY HAND IN PRODUCTION BEFORE THE APP IS DEPLOYED, or the owner's own
-- accounts could lose /admin (and free admin renders) if their profile was
-- never flagged. Only CONFIRMED accounts on the owner's two addresses are
-- flagged. Anyone else in the ADMIN_EMAILS env list must be flagged on
-- purpose (one update per person) — the list alone no longer grants anything.

update public.profiles p
set is_admin = true
from auth.users u
where u.id = p.id
  and lower(u.email) in ('trenttdaniel@gmail.com', 'tdaniel@botmakers.ai')
  and u.email_confirmed_at is not null
  and coalesce(p.is_admin, false) = false;

-- Check: who is an admin now (should list the owner's confirmed accounts and
-- any other flagged admins you expect, e.g. Phil).
select p.id, u.email, p.is_admin, u.email_confirmed_at
from public.profiles p
join auth.users u on u.id = p.id
where p.is_admin = true;
