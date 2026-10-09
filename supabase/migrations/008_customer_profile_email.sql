-- Reusable contact email for customer profiles. Individual quotations retain
-- their own email so a user can override it for a particular document.
alter table public.customers
    add column if not exists email text;

create index if not exists customers_email_idx
    on public.customers (email)
    where email is not null;
