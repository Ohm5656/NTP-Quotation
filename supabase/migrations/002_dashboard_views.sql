-- =========================================================
-- NTP Quotation Management
-- Dashboard Views
-- =========================================================

create or replace view public.customer_quotation_summary
with (security_invoker = true)
as
select
    c.id as customer_id,
    c.name as customer_name,

    count(q.id)::bigint as quotation_count,

    coalesce(
        sum(q.total_amount),
        0
    )::numeric(18, 2) as total_quoted_amount,

    min(q.quotation_date) as first_quotation_date,

    max(q.quotation_date) as latest_quotation_date

from public.customers c

left join public.quotations q
    on q.customer_id = c.id
    and q.deleted_at is null

group by
    c.id,
    c.name;