import type { OrderDetails, OrderItem } from "@/components/orders/types";

export type ProductionItemStage = "cut" | "print" | "sew" | "outsourcing";

export function getPrintingService(order: OrderDetails) {
  return order.services.find((item) => item.service.type === "serigrafia");
}

export function getItemPrintingService(item: OrderItem) {
  return item.services.find((service) => service.service.type === "serigrafia");
}

export function itemHasService(item: OrderItem, type: "corte" | "serigrafia" | "confeccao") {
  return item.services.some((service) => service.service.type === type);
}

export function itemNeedsStage(item: OrderItem, stage: "cut" | "print" | "sew" | "outsourcing") {
  if (stage === "cut") return itemHasService(item, "corte");
  if (stage === "print") return itemHasService(item, "serigrafia");
  if (stage === "sew") return itemHasService(item, "confeccao") && item.sewing_mode === "internal";
  return itemHasService(item, "confeccao") && item.sewing_mode === "outsourced";
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
  if (itemNeedsStage(item, "cut") && !itemStageDone(item, "cut")) return "cut";
  if (itemNeedsStage(item, "print") && !itemStageDone(item, "print")) return "print";
  if (itemNeedsStage(item, "sew") && !itemStageDone(item, "sew")) return "sew";
  if (itemNeedsStage(item, "outsourcing")) return "outsourcing";
  return "done";
}

export function flowStageOptions(item: OrderItem): ProductionItemStage[] {
  return [
    itemNeedsStage(item, "cut") ? "cut" : null,
    itemNeedsStage(item, "print") ? "print" : null,
    itemNeedsStage(item, "sew") ? "sew" : null,
    itemNeedsStage(item, "outsourcing") ? "outsourcing" : null
  ].filter(Boolean) as ProductionItemStage[];
}

export function itemReadyForOutsourcing(item: OrderItem) {
  if (!itemNeedsStage(item, "outsourcing")) return false;
  if (itemNeedsStage(item, "cut") && !itemStageDone(item, "cut")) return false;
  if (itemNeedsStage(item, "print") && !itemStageDone(item, "print")) return false;
  return true;
}

export function itemFlowLabel(item: OrderItem) {
  const stages = flowStageOptions(item).map((stage) => {
    if (stage === "cut") return "Corte";
    if (stage === "print") return "Serigrafia";
    if (stage === "sew") return "Confeccao interna";
    return "Terceirizacao";
  });
  return stages.length > 0 ? stages.join(" -> ") : "Sem etapas produtivas";
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
