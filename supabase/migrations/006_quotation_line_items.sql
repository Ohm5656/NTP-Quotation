alter table public.quotations
add column if not exists remarks text,
add column if not exists discount_amount numeric(18, 2) not null default 0,
add column if not exists vat_rate numeric(6, 4) not null default 0.07;

create table if not exists public.quotation_line_items (
    id uuid primary key default gen_random_uuid(),
    quotation_id uuid not null references public.quotations(id) on delete cascade,
    line_no integer not null,
    description text not null,
    unit_price numeric(18, 2),
    quantity numeric(18, 3),
    unit text,
    show_item_number boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint quotation_line_items_quotation_line_unique unique (quotation_id, line_no)
);

create index if not exists quotation_line_items_quotation_id_idx
on public.quotation_line_items (quotation_id, line_no);

drop trigger if exists quotation_line_items_set_updated_at on public.quotation_line_items;
create trigger quotation_line_items_set_updated_at
before update on public.quotation_line_items
for each row
execute function public.set_updated_at();

alter table public.quotation_line_items enable row level security;

create policy "authenticated users can view quotation line items"
on public.quotation_line_items for select to authenticated using (true);

create policy "authenticated users can insert quotation line items"
on public.quotation_line_items for insert to authenticated with check (true);

create policy "authenticated users can update quotation line items"
on public.quotation_line_items for update to authenticated using (true) with check (true);

create policy "authenticated users can delete quotation line items"
on public.quotation_line_items for delete to authenticated using (true);
