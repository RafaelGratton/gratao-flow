import type { FinancialStatus, OrderItem, ProductionStatus } from "@/components/orders/types";

export type ClientOrderGroupOrder = {
  id: number;
  client_order_group_id: number | null;
  client: { id: number; name: string; phone?: string };
  product: { id: number; name: string };
  size: { id: number; label: string };
  color: string;
  quantity_requested: number;
  production_status: ProductionStatus;
  production_paused: boolean;
  financial_status: FinancialStatus;
  total_amount: string;
  amount_paid: string;
  amount_due: string;
  outsourcing_revenue_total: string;
  outsourcing_cost_total: string;
  outsourcing_paid_total: string;
  outsourcing_pending_total: string;
  estimated_result: string;
  items: OrderItem[];
  payments: Array<{
    id: number;
    amount: string;
    payment_method: string;
    paid_at: string;
    notes: string | null;
    created_at: string;
  }>;
  created_at: string;
};

export type ClientOrderGroup = {
  id: number;
  client_id: number;
  client: { id: number; name: string; phone: string };
  reference: string;
  notes: string | null;
  production_status: ProductionStatus;
  financial_status: FinancialStatus;
  total_amount: string;
  amount_paid: string;
  amount_due: string;
  outsourcing_revenue_total: string;
  quantity_requested: number;
  order_count: number;
  outsourcing_cost_total: string;
  outsourcing_paid_total: string;
  outsourcing_pending_total: string;
  estimated_result: string;
  orders: ClientOrderGroupOrder[];
  created_at: string;
  updated_at: string;
};

export type ClientOrderGroupCreatePayload = {
  client_id: number;
  reference: string;
  notes: string | null;
  order_ids: number[];
};

export type ClientOrderGroupUpdatePayload = {
  reference: string;
  notes: string | null;
};
