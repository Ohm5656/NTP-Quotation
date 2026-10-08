-- Customer details entered from the quotation worksheet.
-- The existing Excel customer file remains the initial source; these fields
-- retain details entered for customers that do not yet exist in that file.

alter table public.customers
    add column if not exists tax_id text,
    add column if not exists address text,
    add column if not exists contact text,
    add column if not exists payment_term text;
