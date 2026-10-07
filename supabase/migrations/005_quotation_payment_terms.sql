alter table public.quotations
add column if not exists payment_term text;

create index if not exists quotations_payment_term_idx
on public.quotations (payment_term)
where payment_term is not null;
