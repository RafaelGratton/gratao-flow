import type { FinancialStatus, ProductionStatus } from "@/components/orders/types";

export type ReportClient = {
  id: number;
  name: string;
  phone: string;
  type: string;
};

export type ReportProduct = {
  id: number;
  name: string;
};

export type ReportSize = {
  id: number;
  label: string;
};

export type ReportService = {
  name: string;
  quantity: number;
  unit_price: string;
  total_price: string;
};

export type ReportItem = {
  id: number;
  product: ReportProduct;
  size: ReportSize;
  color: string;
  quantity_requested: number;
  quantity_cut: number;
  quantity_printed: number;
  quantity_sewn: number;
  quantity_delivered: number;
  delivery_status: string;
  sewing_mode: string | null;
  services: ReportService[];
  outsourcing_services?: ReportService[];
};

export type InternalReportPayment = {
  amount: string;
  payment_method: string;
  paid_at: string;
  notes: string | null;
};

export type ClientReportPayment = {
  amount: string;
  payment_method: string;
  paid_at: string;
};

export type InternalReportProductionEvent = {
  order_item_id: number | null;
  event_type: string;
  quantity: number | null;
  notes: string | null;
  from_status: ProductionStatus | null;
  to_status: ProductionStatus | null;
  created_at: string;
};

export type InternalReportOutsourcing = {
  order_item_id: number | null;
  outsourcer: string | null;
  quantity_sent: number;
  quantity_returned: number;
  customer_unit_price: string;
  outsourcer_unit_price: string;
  customer_total: string;
  outsourcer_total: string;
  profit_total: string;
  status: string;
  payout_status: string;
};

export type InternalOrderReport = {
  order_id: number;
  client: ReportClient;
  quantity_requested: number;
  quantity_cut: number;
  quantity_printed: number;
  quantity_sewn: number;
  quantity_extra: number;
  items: ReportItem[];
  total_amount: string;
  amount_paid: string;
  amount_due: string;
  payments: InternalReportPayment[];
  production_status: ProductionStatus;
  financial_status: FinancialStatus;
  production_events: InternalReportProductionEvent[];
  outsourcings: InternalReportOutsourcing[];
};

export type ClientOrderReport = {
  client: ReportClient;
  order_id: number;
  quantity: number;
  items: ReportItem[];
  total_amount: string;
  payments: ClientReportPayment[];
  amount_paid: string;
  amount_due: string;
  production_status: string;
};
