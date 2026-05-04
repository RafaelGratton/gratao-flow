import type { OrderDetails } from "@/components/orders/types";

export function getPrintingService(order: OrderDetails) {
  return order.services.find((item) => item.service.type === "serigrafia");
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
