import type { DeliveryItem } from "@/components/deliveries/types";
import type { OperationalPriority, OrderItem } from "@/components/orders/types";
import {
  activeOrderItems,
  buildOperationalQueueItem,
  type OperationalQueueItem
} from "@/components/production/helpers";
import type { StockItem } from "@/components/stock/types";
import type {
  AttentionAlert,
  DashboardModel,
  DashboardSource,
  DashboardStage,
  DeliveryPriority,
  PausedOrder,
  StockOpportunity
} from "@/components/dashboard/types";

const priorityRank: Record<OperationalPriority, number> = {
  critical: 0,
  urgent: 1,
  normal: 2
};

export function buildDashboardModel(source: DashboardSource): DashboardModel {
  const rows = source.activeOrders.flatMap((order) =>
    activeOrderItems(order).map((item, index) => buildOperationalQueueItem(order, item, index + 1))
  );
  const freePieces = source.stockItems.filter((item) => item.category === "piece");
  const urgentOrderIds = uniqueOrderIds(
    rows.filter((row) => row.item.operational_priority !== "normal")
  );
  const bottleneckOrderIds = uniqueOrderIds(rows.filter((row) => row.bottlenecks.length > 0));
  const pausedOrders = buildPausedOrders(source.activeOrders);

  return {
    summary: {
      activeOrders: source.activeOrders.length,
      urgentOrders: urgentOrderIds.size,
      pausedOrders: pausedOrders.length,
      readyDeliveries: source.deliveries.summary.ready,
      freeCutPieces: freePieces.reduce((total, item) => total + stockQuantity(item), 0),
      bottleneckOrders: bottleneckOrderIds.size
    },
    activeOrders: source.activeOrders,
    rows,
    alerts: buildAttentionAlerts(rows, pausedOrders, freePieces, source.deliveries.items),
    stages: buildStages(rows, source.deliveries.items, urgentOrderIds),
    opportunities: buildStockOpportunities(rows, freePieces),
    pausedOrders,
    deliveryPriorities: buildDeliveryPriorities(source.deliveries.items),
    deliveries: source.deliveries
  };
}

function buildAttentionAlerts(
  rows: OperationalQueueItem[],
  pausedOrders: PausedOrder[],
  freePieces: StockItem[],
  deliveryItems: DeliveryItem[]
) {
  const alerts: AttentionAlert[] = [];
  const includedRows = new Set<number>();

  rows
    .filter((row) => row.item.operational_priority !== "normal")
    .forEach((row) => {
      const missing = row.balances.missingCut;
      const available = compatibleStockBalance(freePieces, row.item);
      let message = `Prioridade ${displayPriority(row.item.operational_priority).toLowerCase()} em ${row.statusLabel.toLowerCase()}.`;
      let metrics: string | undefined;
      let href = "/production";
      let action = "Ver producao";

      if (missing > 0) {
        metrics = `Precisa destinar: ${missing} | Disponível em estoque: ${available}`;
        href = "/cutting";
        action = "Abrir Corte";
        if (available >= missing) {
          message = "Pode ser atendida integralmente com peças já cortadas.";
        } else if (available > 0) {
          message = `Estoque atende parcialmente esta OS: ${available} de ${missing} necessárias.`;
        } else {
          message = "Necessita novo corte ou acompanhamento da etapa atual.";
        }
      }

      alerts.push({
        key: `priority-${row.item.id}`,
        rank: priorityRank[row.item.operational_priority],
        ageDays: row.ageDays,
        badge: displayPriority(row.item.operational_priority),
        badgeTone: row.item.operational_priority === "critical" ? "danger" : "warning",
        title: `OS #${row.order.id} - ${row.order.client.name}`,
        detail: itemDescription(row.item),
        metrics,
        message,
        href,
        action
      });
      includedRows.add(row.item.id);
    });

  pausedOrders
    .filter((paused) => paused.allocatedPieces > 0)
    .forEach((paused) => {
      const orderRows = rows.filter((row) => row.order.id === paused.order.id);
      alerts.push({
        key: `paused-${paused.order.id}`,
        rank: 2,
        ageDays: Math.max(...orderRows.map((row) => row.ageDays), 0),
        badge: "Pausada",
        badgeTone: "warning",
        title: `OS #${paused.order.id} - ${paused.order.client.name}`,
        detail: `${paused.items} ${paused.items === 1 ? "item" : "itens"} na OS`,
        metrics: `Peças destinadas: ${paused.allocatedPieces}`,
        message: "Produção pausada com peças destinadas. Verifique possível devolução ao estoque.",
        href: `/orders/${paused.order.id}`,
        action: "Abrir OS"
      });
    });

  deliveryItems
    .filter(isDeliveryAttention)
    .forEach((item) => {
      const waitingDays = Math.max(item.ready_waiting_days ?? 0, item.partially_delivered_days ?? 0);
      const message = item.has_weak_delivery_proof
        ? "Entrega registrada com evidência de retirada incompleta."
        : item.queue_status === "partial"
          ? "Entrega parcial requer acompanhamento do saldo restante."
          : "Pronto para retirada aguardando atendimento.";
      alerts.push({
        key: `delivery-${item.order_item_id}`,
        rank: 3,
        ageDays: waitingDays,
        badge: item.queue_status === "partial" ? "Entrega parcial" : "Retirada",
        badgeTone: item.has_weak_delivery_proof ? "danger" : "warning",
        title: `OS #${item.order_id} - ${item.client.name}`,
        detail: `${item.product.name} / ${item.size.label} / ${item.color || "sem cor"}`,
        metrics: item.quantity_available_to_deliver > 0
          ? `Disponível para retirada: ${item.quantity_available_to_deliver}`
          : undefined,
        message,
        href: "/deliveries",
        action: "Ver entregas"
      });
    });

  rows
    .filter((row) => !includedRows.has(row.item.id) && row.bottlenecks.includes("outsourcing_wait"))
    .forEach((row) => {
      alerts.push({
        key: `return-${row.item.id}`,
        rank: 4,
        ageDays: row.ageDays,
        badge: "Aguardando retorno",
        badgeTone: "warning",
        title: `OS #${row.order.id} - ${row.order.client.name}`,
        detail: itemDescription(row.item),
        metrics: `Enviado e sem retorno: ${row.balances.awaitingReturn}`,
        message: "Terceirização aguardando retorno.",
        href: "/outsourcing",
        action: "Ver terceirizacao"
      });
      includedRows.add(row.item.id);
    });

  rows
    .filter((row) => !includedRows.has(row.item.id) && row.bottlenecks.length > 0)
    .forEach((row) => {
      alerts.push({
        key: `bottleneck-${row.item.id}`,
        rank: 5,
        ageDays: row.ageDays,
        badge: "Gargalo",
        badgeTone: "danger",
        title: `OS #${row.order.id} - ${row.order.client.name}`,
        detail: itemDescription(row.item),
        message: row.blockers[0] ?? "Item requer acompanhamento operacional.",
        href: "/production",
        action: "Ver producao"
      });
    });

  return alerts
    .sort((a, b) => a.rank - b.rank || b.ageDays - a.ageDays || a.title.localeCompare(b.title))
    .slice(0, 8);
}

function buildStages(
  rows: OperationalQueueItem[],
  deliveryItems: DeliveryItem[],
  urgentOrderIds: Set<number>
): DashboardStage[] {
  const cutRows = rows.filter((row) => row.stage === "cut" && row.balances.missingCut > 0);
  const printRows = rows.filter((row) => row.stage === "print");
  const sewingRows = rows.filter((row) => row.stage === "sew");
  const outsourcingRows = rows.filter((row) => row.balances.readyForOutsourcing > 0);
  const returnRows = rows.filter((row) => row.balances.awaitingReturn > 0);
  const deliveryRows = deliveryItems.filter((item) => item.quantity_available_to_deliver > 0);

  return [
    rowStage("cut", "Aguardando destinação", "/cutting", cutRows, "peças a destinar", (row) => row.balances.missingCut),
    rowStage("print", "DTF / Serigrafia", "/printing", printRows, "peças pendentes", (row) => row.balances.missingPrint),
    rowStage("sew", "Confecção", "/sewing", sewingRows, "peças pendentes", (row) => row.balances.missingSewing),
    rowStage("outsourcing", "Terceirização", "/outsourcing", outsourcingRows, "peças p/ envio", (row) => row.balances.readyForOutsourcing),
    rowStage("return", "Aguardando retorno", "/outsourcing", returnRows, "peças aguardando", (row) => row.balances.awaitingReturn),
    {
      key: "delivery",
      label: "Entrega",
      href: "/deliveries",
      orderCount: new Set(deliveryRows.map((item) => item.order_id)).size,
      pieces: deliveryRows.reduce((total, item) => total + item.quantity_available_to_deliver, 0),
      pieceLabel: "peças disponíveis",
      priorityOrders: new Set(
        deliveryRows.filter((item) => urgentOrderIds.has(item.order_id)).map((item) => item.order_id)
      ).size
    }
  ];
}

function rowStage(
  key: string,
  label: string,
  href: string,
  rows: OperationalQueueItem[],
  pieceLabel: string,
  quantity: (row: OperationalQueueItem) => number
): DashboardStage {
  return {
    key,
    label,
    href,
    orderCount: uniqueOrderIds(rows).size,
    pieces: rows.reduce((total, row) => total + quantity(row), 0),
    pieceLabel,
    priorityOrders: uniqueOrderIds(
      rows.filter((row) => row.item.operational_priority !== "normal")
    ).size
  };
}

function buildStockOpportunities(rows: OperationalQueueItem[], stockItems: StockItem[]) {
  const pieces = new Map<string, StockOpportunity>();
  const pendingRows = rows.filter((row) => row.balances.missingCut > 0);

  stockItems.forEach((item) => {
    const quantity = stockQuantity(item);
    if (quantity <= 0 || item.product_id === null || item.size_id === null) return;
    const key = stockKey(item.product_id, item.size_id, item.color);
    const current = pieces.get(key);
    if (current) {
      current.quantity += quantity;
      return;
    }
    pieces.set(key, {
      key,
      product: item.product?.name ?? item.name,
      size: item.size?.label ?? "-",
      color: item.color || "sem cor",
      quantity,
      compatibleOrders: 0,
      priority: null,
      indication: "Sem OS pendente compatível",
      indicationTone: "neutral"
    });
  });

  pieces.forEach((opportunity) => {
    const matches = pendingRows.filter((row) => stockKeyForOrderItem(row.item) === opportunity.key);
    const priorityRows = matches.filter((row) => row.item.operational_priority !== "normal");
    opportunity.compatibleOrders = uniqueOrderIds(matches).size;
    opportunity.priority = highestPriority(matches);

    if (priorityRows.some((row) => row.balances.missingCut <= opportunity.quantity)) {
      opportunity.indication = "Atende integralmente OS urgente/crítica";
      opportunity.indicationTone = "success";
    } else if (matches.length > 0) {
      opportunity.indication = "Atendimento parcial disponível";
      opportunity.indicationTone = "warning";
    }
  });

  return Array.from(pieces.values())
    .sort((a, b) => {
      const matchingDiff = Number(b.compatibleOrders > 0) - Number(a.compatibleOrders > 0);
      if (matchingDiff !== 0) return matchingDiff;
      const priorityDiff = priorityRank[a.priority ?? "normal"] - priorityRank[b.priority ?? "normal"];
      if (priorityDiff !== 0) return priorityDiff;
      return b.quantity - a.quantity;
    })
    .slice(0, 6);
}

function buildPausedOrders(orders: DashboardSource["activeOrders"]) {
  return orders
    .filter((order) => order.production_paused)
    .map((order) => ({
      order,
      allocatedPieces: activeOrderItems(order).reduce((total, item) => total + item.quantity_cut, 0),
      items: activeOrderItems(order).length
    }))
    .sort((a, b) => b.allocatedPieces - a.allocatedPieces || a.order.id - b.order.id);
}

function buildDeliveryPriorities(items: DeliveryItem[]): DeliveryPriority[] {
  return items
    .filter((item) => item.queue_status !== "delivered" || item.has_weak_delivery_proof)
    .sort((a, b) => {
      const warningDiff = Number(hasDeliveryWarning(b)) - Number(hasDeliveryWarning(a));
      if (warningDiff !== 0) return warningDiff;
      const ageDiff = deliveryAge(b) - deliveryAge(a);
      if (ageDiff !== 0) return ageDiff;
      return b.quantity_available_to_deliver - a.quantity_available_to_deliver;
    })
    .slice(0, 4)
    .map((item) => {
      if (item.has_weak_delivery_proof) {
        return { item, reason: "Prova de retirada incompleta", tone: "danger" };
      }
      if (item.queue_status === "partial") {
        return { item, reason: "Entrega parcial", tone: "warning" };
      }
      if (item.quantity_available_to_deliver > 0) {
        return { item, reason: `Pronto ha ${deliveryAge(item)} dia(s)`, tone: "accent" };
      }
      return { item, reason: "Aguardando produção", tone: "neutral" };
    });
}

function isDeliveryAttention(item: DeliveryItem) {
  return (
    item.has_weak_delivery_proof ||
    item.queue_status === "partial" ||
    (item.quantity_available_to_deliver > 0 && (item.ready_waiting_days ?? 0) >= 3) ||
    item.bottleneck_flags.length > 0
  );
}

function hasDeliveryWarning(item: DeliveryItem) {
  return isDeliveryAttention(item);
}

function deliveryAge(item: DeliveryItem) {
  return Math.max(item.ready_waiting_days ?? 0, item.partially_delivered_days ?? 0);
}

function itemDescription(item: OrderItem) {
  return `${item.product.name} / ${item.size.label} / ${item.color || "sem cor"}`;
}

function displayPriority(priority: OperationalPriority) {
  if (priority === "critical") return "Crítica";
  if (priority === "urgent") return "Urgente";
  return "Normal";
}

function compatibleStockBalance(items: StockItem[], item: OrderItem) {
  return items
    .filter((stockItem) => stockKeyForStock(stockItem) === stockKeyForOrderItem(item))
    .reduce((total, stockItem) => total + stockQuantity(stockItem), 0);
}

function highestPriority(rows: OperationalQueueItem[]) {
  return rows.reduce<OperationalPriority | null>((highest, row) => {
    const priority = row.item.operational_priority;
    if (!highest || priorityRank[priority] < priorityRank[highest]) return priority;
    return highest;
  }, null);
}

function uniqueOrderIds(rows: OperationalQueueItem[]) {
  return new Set(rows.map((row) => row.order.id));
}

function stockQuantity(item: StockItem) {
  const quantity = Number(item.quantity);
  return Number.isFinite(quantity) ? quantity : 0;
}

function stockKeyForStock(item: StockItem) {
  return stockKey(item.product_id, item.size_id, item.color);
}

function stockKeyForOrderItem(item: OrderItem) {
  return stockKey(item.product_id, item.size_id, item.color);
}

function stockKey(productId: number | null, sizeId: number | null, color: string | null) {
  return `${productId ?? "-"}:${sizeId ?? "-"}:${color ?? ""}`;
}
