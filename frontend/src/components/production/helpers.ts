import type {
  OperationalPriority,
  OrderDetails,
  OrderItem,
  OrderOutsourcing
} from "@/components/orders/types";

export type ProductionItemStage = "cut" | "print" | "sew" | "outsourcing";
export type ProductionQueueStage = ProductionItemStage | "delivery" | "done";
export type OperationalStatus =
  | "waiting_cut"
  | "in_cut"
  | "waiting_print"
  | "in_print"
  | "waiting_sewing"
  | "in_sewing"
  | "outsourced"
  | "waiting_return"
  | "partial_ready"
  | "ready"
  | "partial_delivered"
  | "delivered"
  | "blocked";
export type BottleneckKind =
  | "delayed"
  | "stopped"
  | "outsourcing_wait"
  | "ready_stopped"
  | "blocked";

export type OperationalBalance = {
  requested: number;
  cut: number;
  printed: number;
  sewn: number;
  productionReady: number;
  missingCut: number;
  missingPrint: number;
  missingSewing: number;
  availableForSewing: number;
  readyForDelivery: number;
  delivered: number;
  remainingToDeliver: number;
  remainingInProduction: number;
  outsourced: number;
  readyForOutsourcing: number;
  awaitingReturn: number;
};

export type OperationalTrace = {
  label: string;
  actor: string;
  at: string;
  notes: string | null;
};

export type OperationalQueueItem = {
  order: OrderDetails;
  item: OrderItem;
  itemNumber: number;
  stage: ProductionQueueStage;
  status: OperationalStatus;
  statusLabel: string;
  nextAction: string;
  balances: OperationalBalance;
  ageDays: number;
  agingLabel: string;
  dueLabel: string;
  traces: OperationalTrace[];
  bottlenecks: BottleneckKind[];
  blockers: string[];
  searchText: string;
};

const statusLabels: Record<OperationalStatus, string> = {
  waiting_cut: "Aguardando corte",
  in_cut: "Em corte",
  waiting_print: "Aguardando DTF",
  in_print: "Em DTF",
  waiting_sewing: "Aguardando costura",
  in_sewing: "Em costura",
  outsourced: "Terceirizado",
  waiting_return: "Aguardando retorno",
  partial_ready: "Pronto parcial",
  ready: "Pronto total",
  partial_delivered: "Entregue parcial",
  delivered: "Entregue total",
  blocked: "Travado"
};

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
  return item.sewing_mode === "outsourced";
}

export function itemStageDone(item: OrderItem, stage: "cut" | "print" | "sew") {
  if (stage === "cut") return item.quantity_cut >= item.quantity_requested;
  if (stage === "print") return item.quantity_printed >= item.quantity_requested;
  return item.quantity_sewn >= item.quantity_requested;
}

export function missingCut(item: OrderItem) {
  return Math.max(item.quantity_requested - item.quantity_cut, 0);
}

export function relevantStage(item: OrderItem): ProductionQueueStage {
  if (item.quantity_delivered >= item.quantity_requested) return "done";
  if (itemNeedsStage(item, "cut") && !itemStageDone(item, "cut")) return "cut";
  if (itemNeedsStage(item, "print") && !itemStageDone(item, "print")) return "print";
  if (itemNeedsStage(item, "sew") && !itemStageDone(item, "sew")) return "sew";
  if (itemNeedsStage(item, "outsourcing")) return "outsourcing";
  return "delivery";
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

export function buildOperationalQueueItem(
  order: OrderDetails,
  item: OrderItem,
  itemNumber: number
): OperationalQueueItem {
  const outsourcings = itemOutsourcings(order, item);
  const activeOutsourced = outsourcings.filter((outsourcing) => outsourcing.status !== "cancelled");
  const outsourced = activeOutsourced.reduce((total, outsourcing) => total + outsourcing.quantity_sent, 0);
  const returned = activeOutsourced.reduce((total, outsourcing) => total + outsourcing.quantity_returned, 0);
  const awaitingReturn = Math.max(outsourced - returned, 0);
  const hasCut = itemNeedsStage(item, "cut");
  const hasPrint = itemNeedsStage(item, "print");
  const hasInternalSewing = itemNeedsStage(item, "sew");
  const hasOutsourcing = itemNeedsStage(item, "outsourcing");
  const requested = item.quantity_requested;
  const delivered = Math.min(item.quantity_delivered, requested);
  const cutBase = hasCut ? Math.min(item.quantity_cut, requested) : requested;
  const printBase = hasPrint ? Math.min(item.quantity_printed, requested) : cutBase;
  const sewingInput = hasPrint ? printBase : cutBase;
  const sewingBase = hasInternalSewing ? Math.min(item.quantity_sewn, requested) : sewingInput;
  const outsourcingInput = hasPrint ? printBase : cutBase;
  const productionReady = hasOutsourcing ? Math.min(returned, requested) : sewingBase;
  const readyForDelivery = Math.max(productionReady - delivered, 0);
  const remainingToDeliver = Math.max(requested - delivered, 0);
  const balances: OperationalBalance = {
    requested,
    cut: cutBase,
    printed: hasPrint ? printBase : 0,
    sewn: hasInternalSewing ? sewingBase : 0,
    productionReady,
    missingCut: hasCut ? Math.max(requested - item.quantity_cut, 0) : 0,
    missingPrint: hasPrint ? Math.max(cutBase - item.quantity_printed, 0) : 0,
    missingSewing: hasInternalSewing ? Math.max(requested - item.quantity_sewn, 0) : 0,
    availableForSewing: hasInternalSewing ? Math.max(sewingInput - item.quantity_sewn, 0) : 0,
    readyForDelivery,
    delivered,
    remainingToDeliver,
    remainingInProduction: Math.max(remainingToDeliver - readyForDelivery, 0),
    outsourced,
    readyForOutsourcing: hasOutsourcing ? Math.max(outsourcingInput - outsourced, 0) : 0,
    awaitingReturn
  };
  const status = deriveOperationalStatus(item, balances, {
    hasPrint,
    hasInternalSewing,
    hasOutsourcing,
    outsourced
  });
  const stage = deriveQueueStage(status);
  const traces = buildTrace(order, item, outsourcings);
  const anchor = agingAnchor(order, item, status, traces);
  const ageDays = daysSince(anchor);
  const nextAction = deriveNextAction(balances, { hasPrint, hasInternalSewing, hasOutsourcing });
  const blockers = deriveBlockers(balances, { hasPrint, hasInternalSewing, hasOutsourcing, outsourced });
  const bottlenecks = deriveBottlenecks(status, ageDays, blockers, item.operational_priority, balances);

  return {
    order,
    item,
    itemNumber,
    stage,
    status,
    statusLabel: statusLabels[status],
    nextAction,
    balances,
    ageDays,
    agingLabel: formatAgingLabel(status, ageDays),
    dueLabel: "Sem prazo",
    traces,
    bottlenecks,
    blockers,
    searchText: [
      order.id,
      order.client.name,
      item.product.name,
      item.color,
      item.size.label,
      item.notes,
      order.notes,
      traces.map((trace) => trace.notes).join(" ")
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
  };
}

export function priorityLabel(priority: OperationalPriority) {
  if (priority === "critical") return "Critico";
  if (priority === "urgent") return "Urgente";
  return "Normal";
}

function deriveOperationalStatus(
  item: OrderItem,
  balances: OperationalBalance,
  flags: { hasPrint: boolean; hasInternalSewing: boolean; hasOutsourcing: boolean; outsourced: number }
): OperationalStatus {
  if (balances.delivered >= balances.requested) return "delivered";
  if (balances.delivered > 0) return "partial_delivered";
  if (balances.readyForDelivery >= balances.requested) return "ready";
  if (balances.readyForDelivery > 0) return "partial_ready";
  if (flags.hasOutsourcing && balances.awaitingReturn > 0) return "waiting_return";
  if (flags.hasOutsourcing && flags.outsourced > 0) return "outsourced";
  if (flags.hasInternalSewing && balances.missingSewing > 0 && balances.missingPrint === 0 && balances.missingCut === 0) {
    return item.quantity_sewn > 0 ? "in_sewing" : "waiting_sewing";
  }
  if (flags.hasPrint && balances.missingPrint > 0 && balances.missingCut === 0) {
    return item.quantity_printed > 0 ? "in_print" : "waiting_print";
  }
  if (balances.missingCut > 0) return item.quantity_cut > 0 ? "in_cut" : "waiting_cut";
  return "blocked";
}

function deriveQueueStage(status: OperationalStatus): ProductionQueueStage {
  if (status === "waiting_cut" || status === "in_cut") return "cut";
  if (status === "waiting_print" || status === "in_print") return "print";
  if (status === "waiting_sewing" || status === "in_sewing") return "sew";
  if (status === "outsourced" || status === "waiting_return") return "outsourcing";
  if (status === "partial_ready" || status === "ready" || status === "partial_delivered") return "delivery";
  if (status === "delivered") return "done";
  return "done";
}

function deriveNextAction(
  balances: OperationalBalance,
  flags: { hasPrint: boolean; hasInternalSewing: boolean; hasOutsourcing: boolean }
) {
  if (balances.delivered >= balances.requested) return "CONCLUIDO";
  if (balances.readyForDelivery > 0) return "ENTREGAR SALDO";
  if (flags.hasPrint && balances.missingPrint > 0) return "DTF";
  if (flags.hasInternalSewing && balances.availableForSewing > 0) return "CONFECCAO";
  if (balances.missingCut > 0) return "CORTE";
  if (flags.hasInternalSewing && balances.missingSewing > 0) return "AGUARDAR ETAPA ANTERIOR";
  if (flags.hasOutsourcing && balances.awaitingReturn > 0) return "AGUARDAR RETORNO";
  if (flags.hasOutsourcing && balances.readyForOutsourcing > 0) {
    return "TERCEIRIZACAO";
  }
  return "VERIFICAR";
}

function deriveBlockers(
  balances: OperationalBalance,
  flags: { hasPrint: boolean; hasInternalSewing: boolean; hasOutsourcing: boolean; outsourced: number }
) {
  const blockers: string[] = [];
  if (balances.readyForDelivery > 0) blockers.push("Ha saldo pronto para retirada");
  if (balances.delivered > 0 && balances.remainingInProduction > 0) {
    blockers.push("Entrega parcial com saldo ainda em producao");
  }
  if (balances.missingCut > 0) blockers.push("Saldo restante aguardando corte");
  if (flags.hasPrint && balances.missingPrint > 0) blockers.push("Saldo restante aguardando DTF");
  if (flags.hasInternalSewing && balances.missingSewing > 0) {
    blockers.push("Saldo restante aguardando confeccao");
  }
  if (flags.hasOutsourcing && balances.awaitingReturn > 0) {
    blockers.push("Saldo terceirizado aguardando retorno");
  }
  if (flags.hasOutsourcing && flags.outsourced === 0 && balances.readyForOutsourcing > 0) {
    blockers.push("Saldo apto para terceirizacao");
  }
  if (balances.remainingToDeliver > 0 && balances.readyForDelivery === 0 && !blockers.length) {
    blockers.push("Sem saldo liberado para entrega");
  }
  return blockers;
}

function deriveBottlenecks(
  status: OperationalStatus,
  ageDays: number,
  blockers: string[],
  priority: OperationalPriority,
  balances: OperationalBalance
) {
  const bottlenecks: BottleneckKind[] = [];
  if (priority === "critical" || ageDays >= 7) bottlenecks.push("delayed");
  if (!["delivered", "ready", "partial_ready"].includes(status) && balances.readyForDelivery === 0 && ageDays >= 3) {
    bottlenecks.push("stopped");
  }
  if (status === "waiting_return" || status === "outsourced") bottlenecks.push("outsourcing_wait");
  if (balances.readyForDelivery > 0 && ageDays >= 1) bottlenecks.push("ready_stopped");
  if (status === "blocked" || (balances.readyForDelivery === 0 && blockers.length > 0)) bottlenecks.push("blocked");
  return Array.from(new Set(bottlenecks));
}

function formatAgingLabel(status: OperationalStatus, ageDays: number) {
  const amount = ageDays === 0 ? "hoje" : `ha ${ageDays} dia${ageDays === 1 ? "" : "s"}`;
  if (status === "ready" || status === "partial_ready") return `pronto ${amount}`;
  if (status === "waiting_print") return `aguardando DTF ${amount}`;
  if (status === "waiting_return") return `aguardando retorno ${amount}`;
  if (status === "partial_delivered") return `aguardando retirada ${amount}`;
  return `parado ${amount}`;
}

function buildTrace(order: OrderDetails, item: OrderItem, outsourcings: OrderOutsourcing[]): OperationalTrace[] {
  const production = order.production_events
    .filter((event) => event.order_item_id === item.id)
    .map((event) => ({
      label: productionEventLabel(event.event_type),
      actor: event.user_name_snapshot || "Responsavel nao informado",
      at: event.created_at,
      notes: [event.reason, event.notes].filter(Boolean).join(" - ") || null
    }));
  const deliveries = (item.delivery_history ?? []).map((entry) => ({
    label: `Entrega registrada (${entry.quantity})`,
    actor: entry.user_name_snapshot || entry.responsible || "Responsavel nao informado",
    at: entry.created_at,
    notes: entry.delivery_notes || entry.notes
  }));
  const outsourcingTraces = outsourcings.map((outsourcing) => ({
    label: outsourcing.status === "returned" || outsourcing.quantity_returned > 0
      ? `Terceirizacao retorno ${outsourcing.quantity_returned}/${outsourcing.quantity_sent}`
      : `Terceirizacao enviada ${outsourcing.quantity_sent}`,
    actor: outsourcing.outsourcer?.name ?? "Terceirizado nao informado",
    at: outsourcing.returned_at ?? outsourcing.sent_at,
    notes: outsourcing.notes
  }));
  return [...production, ...deliveries, ...outsourcingTraces].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );
}

function agingAnchor(
  order: OrderDetails,
  item: OrderItem,
  status: OperationalStatus,
  traces: OperationalTrace[]
) {
  if (status === "waiting_cut" || status === "in_cut") return item.created_at || order.created_at;
  return traces[0]?.at ?? item.created_at ?? order.created_at;
}

function daysSince(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  const diff = Date.now() - timestamp;
  return Math.max(Math.floor(diff / 86_400_000), 0);
}

function itemOutsourcings(order: OrderDetails, item: OrderItem) {
  return order.outsourcings.filter((outsourcing) => outsourcing.order_item_id === item.id);
}

function productionEventLabel(eventType: string) {
  if (eventType === "cut_registered") return "Corte registrado";
  if (eventType === "print_registered") return "DTF registrado";
  if (eventType === "sewing_registered") return "Confeccao registrada";
  if (eventType === "outsourcing_sent") return "Terceirizacao enviada";
  if (eventType === "outsourcing_returned") return "Terceirizacao retornada";
  if (eventType === "delivery_registered") return "Entrega registrada";
  if (eventType === "loss_registered") return "Perda registrada";
  if (eventType === "rework_registered") return "Retrabalho registrado";
  if (eventType === "adjustment_registered") return "Ajuste registrado";
  if (eventType === "status_changed") return "Status alterado";
  return eventType;
}
