import type { DeliveryStatus } from "@/components/orders/types";

export type DeliveryHistory = {
  id: number;
  order_id: number;
  order_item_id: number;
  quantity: number;
  responsible: string;
  notes: string | null;
  delivered_at: string;
  created_at: string;
};

export type DeliveryItem = {
  order_id: number;
  order_item_id: number;
  client: { id: number; name: string };
  product: { id: number; name: string };
  size: { id: number; label: string };
  color: string;
  quantity_requested: number;
  quantity_ready: number;
  quantity_delivered: number;
  quantity_remaining: number;
  quantity_pending_production: number;
  delivery_status: DeliveryStatus;
  delivered_at: string | null;
  history: DeliveryHistory[];
};

export type DeliverySummary = {
  ready: number;
  partially_delivered: number;
  delivered_today: number;
  pending: number;
};

export type DeliveryList = {
  summary: DeliverySummary;
  items: DeliveryItem[];
};
