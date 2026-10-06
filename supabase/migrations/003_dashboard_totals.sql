-- =========================================================
-- Dashboard totals
--
-- ยอดรวมระดับระบบต้องคำนวณจาก quotations โดยตรง
-- ไม่คำนวณจาก customer cards เพราะ quotation บางรายการ
-- ไม่มี Customer
-- =========================================================

create or replace view public.quotation_dashboard_totals
with (security_invoker = true)
as
select
    count(*)::bigint
        as quotation_count,

    coalesce(
        sum(total_amount),
        0
    )::numeric(18, 2)
        as total_quoted_amount,

    count(*) filter (
        where customer_id is null
    )::bigint
        as unassigned_customer_count,

    coalesce(
        sum(total_amount) filter (
            where customer_id is null
        ),
        0
    )::numeric(18, 2)
        as unassigned_customer_amount

from public.quotations

where deleted_at is null;