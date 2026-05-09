import type { FinancialStatus, ProductionFlow, ProductionStatus } from "@/components/orders/types";

export const productionLabels: Record<ProductionStatus, string> = {
  created: "Criada",
  in_cut: "Em corte",
  cut_done: "Corte concluído",
  waiting_print: "Aguardando serigrafia",
  in_print: "Em serigrafia",
  print_done: "Serigrafia concluída",
  waiting_sewing: "Aguardando confecção",
  in_sewing: "Em confecção",
  sewing_done: "Confecção concluída",
  ready: "Pronta",
  delivered: "Entregue",
  outsourced: "Terceirizada",
  returned: "Retornada",
  cancelled: "Cancelada"
};

export const financialLabels: Record<FinancialStatus, string> = {
  pending: "Pendente",
  partial: "Parcial",
  paid: "Pago"
};

export const productionFlowLabels: Record<ProductionFlow, string> = {
  deliver_after_cut: "Apenas cortar e entregar",
  deliver_after_print: "Cortar + serigrafar e entregar",
  internal_sewing: "Cortar + confeccionar internamente",
  outsourced_sewing: "Cortar + terceirizar confecção"
};

export function productionTone(status: ProductionStatus) {
  if (status === "cancelled") return "danger";
  if (["ready", "delivered", "sewing_done"].includes(status)) return "done";
  if (status.startsWith("in_")) return "active";
  if (status.startsWith("waiting_")) return "warning";
  return "idle";
}

export function financialTone(status: FinancialStatus) {
  if (status === "paid") return "done";
  if (status === "partial") return "warning";
  return "idle";
}

export function hasPrintingService(services: Array<{ service: { type: string } }>) {
  return services.some((item) => item.service.type === "serigrafia");
}
