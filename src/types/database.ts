export type CustomerSummary = {
  customer_id: string;
  customer_name: string;

  quotation_count: number;

  total_quoted_amount:
    | number
    | string;

  first_quotation_date:
    | string
    | null;

  latest_quotation_date:
    | string
    | null;
};

export type Quotation = {
  id: string;

  quotation_no:
    | string
    | null;

  quotation_date:
    | string
    | null;

  source_date_raw:
    | string
    | null;

  boq_no:
    | string
    | null;

  customer_id:
    | string
    | null;

  customer_name_raw:
    | string
    | null;

  project_name:
    | string
    | null;

  total_amount:
    | number
    | string
    | null;

  po:
    | string
    | null;

  payment_term:
    | string
    | null;

  attention:
    | string
    | null;

  email:
    | string
    | null;

  created_at: string;
  updated_at: string;
  deleted_at:
    | string
    | null;
};

export type DashboardTotals = {
  quotation_count: number;

  total_quoted_amount:
    | number
    | string;

  unassigned_customer_count:
    number;

  unassigned_customer_amount:
    | number
    | string;
};

export type CustomerOption = {
  id: string;
  name: string;
};

export type QuotationListItem = {
  id: string;

  quotation_no:
    | string
    | null;

  quotation_date:
    | string
    | null;

  boq_no:
    | string
    | null;

  customer_id:
    | string
    | null;

  customer_name_raw:
    | string
    | null;

  project_name:
    | string
    | null;

  total_amount:
    | number
    | string
    | null;

  po:
    | string
    | null;

  payment_term:
    | string
    | null;

  attention:
    | string
    | null;

  email:
    | string
    | null;

  source_row:
    | number
    | null;
};
