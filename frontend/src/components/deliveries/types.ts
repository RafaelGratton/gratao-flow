import type { DeliveryStatus } from "@/components/orders/types";

export type DeliveryHistory = {
  id: number;
  order_id: number;
  order_item_id: number;
  quantity: number;
  user_id: number | null;
  user_name_snapshot: string | null;
  responsible: string;
  picked_up_by: string | null;
  pickup_document: string | null;
  delivery_notes: string | null;
  notes: string | null;
  delivered_at: string;
  created_at: string;
};

export type DeliveryItem = {
  order_id: number;
  order_item_id: number;
  production_paused: boolean;
  client: { id: number; name: string };
  product: { id: number; name: string };
  size: { id: number; label: string };
  color: string;
  quantity_requested: number;
  quantity_ready: number;
  quantity_ready_total: number;
  quantity_available_to_deliver: number;
  quantity_delivered: number;
  quantity_remaining: number;
  quantity_pending_production: number;
  delivery_status: DeliveryStatus;
  queue_status: DeliveryQueueStatus;
  operational_status: DeliveryOperationalStatus;
  delivered_at: string | null;
  ready_since: string | null;
  available_since: string | null;
  ready_waiting_days: number | null;
  last_delivery_at: string | null;
  last_delivery_days: number | null;
  partially_delivered_since: string | null;
  partially_delivered_days: number | null;
  last_picked_up_by: string | null;
  last_pickup_document: string | null;
  has_multiple_deliveries: boolean;
  has_weak_delivery_proof: boolean;
  important_notes: string[];
  bottleneck_flags: string[];
  history: DeliveryHistory[];
};

export type DeliveryQueueStatus = "ready_for_pickup" | "partial" | "pending" | "delivered";

export type DeliveryOperationalStatus =
  | "waiting_production"
  | "ready_partial_waiting_pickup"
  | "ready_total_waiting_pickup"
  | "delivered_partial_waiting_pickup"
  | "delivered_partial_waiting_production"
  | "delivered_total";

export type DeliverySummary = {
  ready: number;
  partial: number;
  delivered: number;
  partially_delivered: number;
  delivered_today: number;
  pending: number;
  waiting_quantity: number;
  weak_proof: number;
};

export type DeliveryList = {
  summary: DeliverySummary;
  items: DeliveryItem[];
};
