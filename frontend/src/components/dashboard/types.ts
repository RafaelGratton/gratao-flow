import type { DeliveryItem, DeliveryList } from "@/components/deliveries/types";
import type { OperationalPriority, OrderDetails } from "@/components/orders/types";
import type { OperationalQueueItem } from "@/components/production/helpers";
import type { StockItem } from "@/components/stock/types";

export type DashboardSource = {
  activeOrders: OrderDetails[];
  stockItems: StockItem[];
  deliveries: DeliveryList;
};

export type OperationalSummary = {
  activeOrders: number;
  urgentOrders: number;
  pausedOrders: number;
  readyDeliveries: number;
  freeCutPieces: number;
  bottleneckOrders: number;
};

export type DashboardStage = {
  key: string;
  label: string;
  href: string;
  orderCount: number;
  pieces: number;
  pieceLabel: string;
  priorityOrders: number;
};

export type StockOpportunity = {
  key: string;
  product: string;
  size: string;
  color: string;
  quantity: number;
  compatibleOrders: number;
  priority: OperationalPriority | null;
  indication: string;
  indicationTone: "success" | "warning" | "neutral";
};

export type AttentionAlert = {
  key: string;
  rank: number;
  ageDays: number;
  badge: string;
  badgeTone: "danger" | "warning" | "accent";
  title: string;
  detail: string;
  metrics?: string;
  message: string;
  href: string;
  action: string;
};

export type PausedOrder = {
  order: OrderDetails;
  allocatedPieces: number;
  items: number;
};

export type DeliveryPriority = {
  item: DeliveryItem;
  reason: string;
  tone: "danger" | "warning" | "accent" | "neutral";
};

export type DashboardModel = {
  summary: OperationalSummary;
  activeOrders: OrderDetails[];
  rows: OperationalQueueItem[];
  alerts: AttentionAlert[];
  stages: DashboardStage[];
  opportunities: StockOpportunity[];
  pausedOrders: PausedOrder[];
  deliveryPriorities: DeliveryPriority[];
  deliveries: DeliveryList;
};
