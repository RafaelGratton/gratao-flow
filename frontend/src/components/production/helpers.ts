import type { OrderDetails, OrderItem, ProductionFlow } from "@/components/orders/types";

export type ProductionItemStage = "cut" | "print" | "sew" | "outsourcing";

export function getPrintingService(order: OrderDetails) {
  return order.services.find((item) => item.service.type === "serigrafia");
}

export function getItemPrintingService(item: OrderItem) {
  return item.services.find((service) => service.service.type === "serigrafia");
}

export function itemNeedsStage(item: OrderItem, stage: "cut" | "print" | "sew" | "outsourcing") {
  if (stage === "cut") return true;
  if (stage === "print") return item.production_flow === "deliver_after_print";
  if (stage === "sew") return item.production_flow === "internal_sewing";
  return item.production_flow === "outsourced_sewing";
}

export function itemStageDone(item: OrderItem, stage: "cut" | "print" | "sew") {
  if (stage === "cut") return item.quantity_cut >= item.quantity_requested;
  if (stage === "print") return item.quantity_printed >= item.quantity_requested;
  return item.quantity_sewn >= item.quantity_requested;
}

export function missingCut(item: OrderItem) {
  return Math.max(item.quantity_requested - item.quantity_cut, 0);
}

export function relevantStage(item: OrderItem): "cut" | "print" | "sew" | "outsourcing" | "done" {
  if (!itemStageDone(item, "cut")) return "cut";
  if (item.production_flow === "deliver_after_cut") return "done";
  if (item.production_flow === "deliver_after_print") {
    return itemStageDone(item, "print") ? "done" : "print";
  }
  if (item.production_flow === "internal_sewing") {
    return itemStageDone(item, "sew") ? "done" : "sew";
  }
  return "outsourcing";
}

export function flowStageOptions(flow: ProductionFlow): ProductionItemStage[] {
  if (flow === "deliver_after_cut") return ["cut"];
  if (flow === "deliver_after_print") return ["cut", "print"];
  if (flow === "internal_sewing") return ["cut", "sew"];
  return ["cut", "outsourcing"];
}

export function hasPrinting(order: OrderDetails) {
  return Boolean(getPrintingService(order));
}

export function serviceList(order: OrderDetails) {
  return order.services.map((item) => item.service.name).join(", ");
}

export function printingServiceLabel(order: OrderDetails) {
  const service = getPrintingService(order);
  if (service?.service.name) return service.service.name;
  if (order.print_type === "front_back") return "Frente e costas";
  if (order.print_type === "front") return "Frente";
  return "Serigrafia";
}
