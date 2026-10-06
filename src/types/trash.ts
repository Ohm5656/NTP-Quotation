export type TrashQuotationItem = {
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

  attention:
    | string
    | null;

  email:
    | string
    | null;

  deleted_at:
    | string
    | null;
};