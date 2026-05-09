export type ProductionStatus =
  | "created"
  | "in_cut"
  | "cut_done"
  | "waiting_print"
  | "in_print"
  | "print_done"
  | "waiting_sewing"
  | "in_sewing"
  | "sewing_done"
  | "ready"
  | "delivered"
  | "outsourced"
  | "returned"
  | "cancelled";

export type FinancialStatus = "pending" | "partial" | "paid";

export type ProductionFlow =
  | "deliver_after_cut"
  | "deliver_after_print"
  | "internal_sewing"
  | "outsourced_sewing";

export type OutsourcingStatus =
  | "sent"
  | "partially_returned"
  | "returned"
  | "delivered_direct"
  | "cancelled";

export type PayoutStatus = "pending" | "paid";

export type CatalogItem = {
  id: number;
  name?: string;
  label?: string;
  type?: string;
  price_per_unit?: string;
  is_active?: boolean;
};

export type OrderSummary = {
  id: number;
  client: { id: number; name: string };
  product: { id: number; name: string };
  size: { id: number; label: string };
  color: string;
  quantity_requested: number;
  production_status: ProductionStatus;
  financial_status: FinancialStatus;
  total_amount: string;
  amount_paid: string;
  amount_due: string;
  items: OrderItem[];
  created_at: string;
};

export type OrderItem = {
  id: number;
  product_id: number;
  product: { id: number; name: string };
  size_id: number;
  size: { id: number; label: string };
  color: string;
  quantity_requested: number;
  quantity_cut: number;
  quantity_printed: number;
  quantity_sewn: number;
  production_flow: ProductionFlow;
  notes: string | null;
  created_at: string;
  services: Array<{
    id: number;
    service_id: number;
    service: { id: number; name: string; type: string; price_per_unit: string };
    quantity: number;
    unit_price: string;
    total_price: string;
    created_at: string;
  }>;
};

export type OrderDetails = OrderSummary & {
  color: string;
  quantity_cut: number;
  quantity_extra: number;
  quantity_printed: number;
  quantity_sewn: number;
  print_type: "front" | "front_back" | null;
  allow_printing_exception: boolean;
  lot: string;
  notes: string | null;
  services: Array<{
    id: number;
    service_id: number;
    service: { id: number; name: string; type: string; price_per_unit: string };
    quantity: number;
    unit_price: string;
    total_price: string;
    created_at: string;
  }>;
  payments: Array<{
    id: number;
    amount: string;
    payment_method: string;
    paid_at: string;
    notes: string | null;
    created_at: string;
  }>;
  production_events: Array<{
    id: number;
    order_item_id: number | null;
    event_type: string;
    quantity: number | null;
    notes: string | null;
    from?: ProductionStatus | null;
    to?: ProductionStatus | null;
    created_at: string;
  }>;
  outsourcings: OrderOutsourcing[];
};

export type Outsourcer = {
  id: number;
  name: string;
  phone: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

export type OrderOutsourcing = {
  id: number;
  outsourcer_id: number | null;
  outsourcer: Outsourcer | null;
  quantity_sent: number;
  quantity_returned: number;
  customer_unit_price: string;
  outsourcer_unit_price: string;
  customer_total: string;
  outsourcer_total: string;
  profit_total: string;
  return_expected: boolean;
  direct_to_customer: boolean;
  status: OutsourcingStatus;
  payout_status: PayoutStatus;
  sent_at: string;
  returned_at: string | null;
  paid_at: string | null;
  notes: string | null;
};
