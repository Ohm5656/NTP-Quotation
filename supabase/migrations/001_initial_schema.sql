-- =========================================================
-- NTP Quotation Management System
-- Initial Database Schema
-- =========================================================

create extension if not exists pgcrypto;

-- =========================================================
-- Customers
--
-- สำคัญ:
-- name เก็บตามข้อความจาก Excel โดยไม่รวมบริษัท/สาขาเอง
-- =========================================================

create table if not exists public.customers (
    id uuid primary key default gen_random_uuid(),

    name text not null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint customers_name_unique unique (name)
);

-- =========================================================
-- Quotations
-- =========================================================

create table if not exists public.quotations (
    id uuid primary key default gen_random_uuid(),

    -- เช่น 6601001 / Q6509019
    -- ห้าม UNIQUE เพราะ Excel มีเลขซ้ำจริง
    quotation_no text,

    -- Database เก็บ ค.ศ. เช่น 2023-01-04
    -- หน้าเว็บค่อยแสดงเป็น พ.ศ.
    quotation_date date,

    -- เก็บค่าต้นฉบับของ Date. ไว้ตรวจสอบย้อนหลัง
    source_date_raw text,

    -- BOQ. จาก Excel
    boq_no text,

    customer_id uuid
        references public.customers(id)
        on update cascade
        on delete restrict,

    -- เก็บชื่อจาก Excel อีกชุด
    -- ต่อให้วันหลังแก้ Customer Master
    -- ข้อมูลต้นฉบับยังตรวจสอบย้อนหลังได้
    customer_name_raw text,

    project_name text,

    total_amount numeric(18, 2),

    po text,

    attention text,

    email text,

    -- =====================================================
    -- Source tracking
    -- =====================================================

    source_file text,
    source_sheet text,
    source_row integer,
    source_row_hash text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    -- Soft delete
    deleted_at timestamptz,

    constraint quotations_source_row_unique
        unique (
            source_file,
            source_sheet,
            source_row
        )
);

-- =========================================================
-- Indexes
-- =========================================================

create index if not exists quotations_quotation_no_idx
    on public.quotations (quotation_no);

create index if not exists quotations_date_idx
    on public.quotations (quotation_date);

create index if not exists quotations_customer_id_idx
    on public.quotations (customer_id);

create index if not exists quotations_deleted_at_idx
    on public.quotations (deleted_at);

create index if not exists quotations_customer_date_idx
    on public.quotations (
        customer_id,
        quotation_date
    );

create index if not exists quotations_total_amount_idx
    on public.quotations (total_amount);

-- =========================================================
-- updated_at
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists customers_set_updated_at
on public.customers;

create trigger customers_set_updated_at
before update on public.customers
for each row
execute function public.set_updated_at();


drop trigger if exists quotations_set_updated_at
on public.quotations;

create trigger quotations_set_updated_at
before update on public.quotations
for each row
execute function public.set_updated_at();

-- =========================================================
-- RLS
-- =========================================================

alter table public.customers
enable row level security;

alter table public.quotations
enable row level security;

-- =========================================================
-- Customers Policies
-- =========================================================

create policy "authenticated users can view customers"
on public.customers
for select
to authenticated
using (true);

create policy "authenticated users can insert customers"
on public.customers
for insert
to authenticated
with check (true);

create policy "authenticated users can update customers"
on public.customers
for update
to authenticated
using (true)
with check (true);

create policy "authenticated users can delete customers"
on public.customers
for delete
to authenticated
using (true);

-- =========================================================
-- Quotations Policies
-- =========================================================

create policy "authenticated users can view quotations"
on public.quotations
for select
to authenticated
using (true);

create policy "authenticated users can insert quotations"
on public.quotations
for insert
to authenticated
with check (true);

create policy "authenticated users can update quotations"
on public.quotations
for update
to authenticated
using (true)
with check (true);

create policy "authenticated users can delete quotations"
on public.quotations
for delete
to authenticated
using (true);