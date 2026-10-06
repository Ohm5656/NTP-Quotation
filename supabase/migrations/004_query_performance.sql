-- =========================================================
-- Read performance for quotations and reports
-- =========================================================

-- The list pages always exclude soft-deleted quotations and sort newest first.
-- These partial indexes keep the hot working set small as the import grows.
create index if not exists quotations_active_date_source_idx
    on public.quotations (
        quotation_date desc nulls last,
        source_row desc
    )
    where deleted_at is null;

create index if not exists quotations_active_customer_date_source_idx
    on public.quotations (
        customer_id,
        quotation_date desc nulls last,
        source_row desc
    )
    where deleted_at is null;

-- Search uses ILIKE with a contains pattern. B-tree indexes cannot accelerate it.
create extension if not exists pg_trgm;

create index if not exists quotations_active_quotation_no_trgm_idx
    on public.quotations using gin (quotation_no gin_trgm_ops)
    where deleted_at is null;

create index if not exists quotations_active_boq_no_trgm_idx
    on public.quotations using gin (boq_no gin_trgm_ops)
    where deleted_at is null;

create index if not exists quotations_active_customer_name_trgm_idx
    on public.quotations using gin (customer_name_raw gin_trgm_ops)
    where deleted_at is null;

create index if not exists quotations_active_project_name_trgm_idx
    on public.quotations using gin (project_name gin_trgm_ops)
    where deleted_at is null;

create index if not exists quotations_active_po_trgm_idx
    on public.quotations using gin (po gin_trgm_ops)
    where deleted_at is null;

create index if not exists quotations_active_attention_trgm_idx
    on public.quotations using gin (attention gin_trgm_ops)
    where deleted_at is null;

create index if not exists quotations_active_email_trgm_idx
    on public.quotations using gin (email gin_trgm_ops)
    where deleted_at is null;

-- Small aggregate views let report pages request summaries instead of moving
-- every historical quotation through the application server.
create or replace view public.quotation_monthly_summary
with (security_invoker = true)
as
select
    extract(year from quotation_date)::integer as gregorian_year,
    extract(month from quotation_date)::integer as month,
    count(*)::bigint as quotation_count,
    count(distinct customer_id)::bigint as customer_count,
    coalesce(sum(total_amount), 0)::numeric(18, 2) as total_amount
from public.quotations
where deleted_at is null
  and quotation_date is not null
group by 1, 2;

create or replace view public.quotation_yearly_summary
with (security_invoker = true)
as
select
    extract(year from quotation_date)::integer as gregorian_year,
    count(*)::bigint as quotation_count,
    count(distinct customer_id)::bigint as customer_count,
    coalesce(sum(total_amount), 0)::numeric(18, 2) as total_amount
from public.quotations
where deleted_at is null
  and quotation_date is not null
group by 1;

create or replace view public.quotation_yearly_customer_summary
with (security_invoker = true)
as
with normalized as (
    select
        extract(year from quotation_date)::integer as gregorian_year,
        customer_id,
        coalesce(
            nullif(trim(customer_name_raw), ''),
            'ไม่ระบุลูกค้า'
        ) as customer_name,
        total_amount
    from public.quotations
    where deleted_at is null
      and quotation_date is not null
)
select
    gregorian_year,
    customer_id,
    min(customer_name) as customer_name,
    count(*)::bigint as quotation_count,
    coalesce(sum(total_amount), 0)::numeric(18, 2) as total_amount
from normalized
group by
    gregorian_year,
    customer_id,
    case
        when customer_id is null then customer_name
        else null
    end;
