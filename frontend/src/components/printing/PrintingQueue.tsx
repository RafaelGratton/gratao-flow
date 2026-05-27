"use client";

import { ChevronDown, ChevronRight, Clock3, Layers3, PlayCircle, Stamp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrderDetails, OrderItem, OrderSummary } from "@/components/orders/types";
import { PrintActionModal } from "@/components/printing/PrintActionModal";
import { getItemPrintingService, itemFlowLabel, itemNeedsStage } from "@/components/production/helpers";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type QueueStage = "waiting_cut" | "ready" | "active" | "done";

type PrintRow = {
  order: OrderDetails;
  item: OrderItem;
  itemNumber: number;
};

type PrintOrderGroup = {
  order: OrderDetails;
  rows: PrintRow[];
  pendingItems: number;
  waitingCutItems: number;
  readyItems: number;
  activeItems: number;
  cutAvailable: number;
  printed: number;
  priority: OrderItem["operational_priority"];
  oldestAt: string;
};

const priorityRank = {
  critical: 0,
  urgent: 1,
  normal: 2
};

function printStage(item: OrderItem): QueueStage {
  if (item.quantity_printed >= item.quantity_requested) return "done";
  if (availableForPrint(item) <= 0) return "waiting_cut";
  if (item.quantity_printed > 0) return "active";
  return "ready";
}

function availableForPrint(item: OrderItem) {
  const cut = Math.min(item.quantity_cut, item.quantity_requested);
  return Math.max(cut - item.quantity_printed, 0);
}

function printServiceLabel(item: OrderItem) {
  const service = getItemPrintingService(item);
  return service?.service.name ?? "Serigrafia";
}

function priorityLabel(priority: OrderItem["operational_priority"]) {
  if (priority === "critical") return "Critico";
  if (priority === "urgent") return "Urgente";
  return "Normal";
}

export function PrintingQueue() {
  const [orders, setOrders] = useState<OrderDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selected, setSelected] = useState<PrintRow | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(() => new Set());

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summaries = await api.get<OrderSummary[]>("/orders");
      const openSummaries = summaries.filter(
        (order) => !["cancelled", "delivered"].includes(order.production_status)
      );
      const details = await Promise.all(
        openSummaries.map((order) => api.get<OrderDetails>(`/orders/${order.id}`))
      );
      setOrders(details);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel carregar a fila de serigrafia.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const rows = useMemo(
    () =>
      orders.flatMap((order) =>
        order.items
          .map((item, index) => ({ order, item, itemNumber: index + 1 }))
          .filter(
            (row) =>
              itemNeedsStage(row.item, "print") &&
              row.item.quantity_printed < row.item.quantity_requested
          )
      ),
    [orders]
  );

  const summary = useMemo(() => {
    const values = { orders: 0, waiting_cut: 0, ready: 0, active: 0 };
    for (const row of rows) {
      const stage = printStage(row.item);
      if (stage !== "done") values[stage] += 1;
    }
    values.orders = new Set(rows.map((row) => row.order.id)).size;
    return values;
  }, [rows]);

  const orderGroups = useMemo<PrintOrderGroup[]>(() => {
    const grouped = new Map<number, PrintRow[]>();

    rows.forEach((row) => {
      const groupRows = grouped.get(row.order.id) ?? [];
      groupRows.push(row);
      grouped.set(row.order.id, groupRows);
    });

    return Array.from(grouped.values())
      .map((groupRows) => {
        const sortedRows = [...groupRows].sort((a, b) => {
          const stageDiff = stageRank(printStage(a.item)) - stageRank(printStage(b.item));
          if (stageDiff !== 0) return stageDiff;

          const priorityDiff =
            priorityRank[a.item.operational_priority] - priorityRank[b.item.operational_priority];
          if (priorityDiff !== 0) return priorityDiff;

          return a.itemNumber - b.itemNumber;
        });
        const stages = sortedRows.map((row) => printStage(row.item));
        const priority = sortedRows.reduce(
          (highest, row) =>
            priorityRank[row.item.operational_priority] < priorityRank[highest]
              ? row.item.operational_priority
              : highest,
          sortedRows[0].item.operational_priority
        );
        const oldestAt = sortedRows
          .map((row) => row.item.created_at || row.order.created_at)
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];

        return {
          order: sortedRows[0].order,
          rows: sortedRows,
          pendingItems: sortedRows.length,
          waitingCutItems: stages.filter((stage) => stage === "waiting_cut").length,
          readyItems: stages.filter((stage) => stage === "ready").length,
          activeItems: stages.filter((stage) => stage === "active").length,
          cutAvailable: sortedRows.reduce((total, row) => total + availableForPrint(row.item), 0),
          printed: sortedRows.reduce((total, row) => total + row.item.quantity_printed, 0),
          priority,
          oldestAt
        };
      })
      .sort((a, b) => {
        const stageDiff = groupStageRank(a) - groupStageRank(b);
        if (stageDiff !== 0) return stageDiff;

        const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
        if (priorityDiff !== 0) return priorityDiff;

        return new Date(a.oldestAt).getTime() - new Date(b.oldestAt).getTime() || a.order.id - b.order.id;
      });
  }, [rows]);

  function handleUpdated(updated: OrderDetails) {
    setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
    setSuccess(`DTF registrado na OS #${updated.id}.`);
  }

  function toggleOrder(orderId: number) {
    setExpandedOrders((current) => {
      const next = new Set(current);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
            Painel operacional de aplicacao DTF por item
          </p>
          <h1 className="mt-1 text-3xl font-black text-ink">Serigrafia</h1>
        </div>
        <Button type="button" variant="secondary" onClick={() => void loadOrders()} disabled={loading}>
          Atualizar fila
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-danger/20 bg-danger/10 p-4 text-sm font-semibold text-danger">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-success/20 bg-success/10 p-4 text-sm font-semibold text-success">
          {success}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "OS na fila", value: summary.orders, icon: Layers3 },
          { label: "Aguardando destinacao", value: summary.waiting_cut, icon: Clock3 },
          { label: "Prontas para DTF", value: summary.ready, icon: Stamp },
          { label: "Em andamento", value: summary.active, icon: PlayCircle }
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-center gap-4">
              <div className="grid h-11 w-11 place-items-center rounded-md bg-accent-soft text-accent-dark">
                <item.icon size={20} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{item.label}</p>
                <p className="mt-1 text-2xl font-black text-ink">{item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="space-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Fila de producao</p>
          <h2 className="mt-1 text-xl font-black text-ink">OS com DTF pendente</h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-lg border border-line bg-white/80" />
            ))}
          </div>
        ) : orderGroups.length === 0 ? (
          <EmptyState
            icon={<Layers3 size={20} />}
            title="Nenhuma OS aguardando DTF"
            description="OS com itens de serigrafia pendentes aparecem nesta fila."
          />
        ) : (
          <div className="space-y-3">
            {orderGroups.map((group) => (
              <PrintOrderCard
                key={group.order.id}
                group={group}
                expanded={expandedOrders.has(group.order.id)}
                onToggle={() => toggleOrder(group.order.id)}
                onRegister={setSelected}
              />
            ))}
          </div>
        )}
      </section>

      <PrintActionModal
        open={Boolean(selected)}
        order={selected?.order ?? null}
        item={selected?.item ?? null}
        onClose={() => setSelected(null)}
        onUpdated={handleUpdated}
      />
    </div>
  );
}

function PrintOrderCard({
  group,
  expanded,
  onToggle,
  onRegister
}: {
  group: PrintOrderGroup;
  expanded: boolean;
  onToggle: () => void;
  onRegister: (row: PrintRow) => void;
}) {
  const pendingLabel = group.pendingItems === 1 ? "item com DTF pendente" : "itens com DTF pendente";

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-4 p-5 xl:grid-cols-[1.1fr_1.25fr_1fr_auto] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-black text-ink">OS #{group.order.id}</span>
            <Badge tone="accent">
              {group.pendingItems} {pendingLabel}
            </Badge>
            <PriorityBadge priority={group.priority} />
            {group.order.production_paused ? <Badge tone="warning">Producao pausada</Badge> : null}
          </div>
          <p className="mt-1 text-sm font-semibold text-muted">{group.order.client.name}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-md border border-line bg-[#FCFAF6] p-3">
          <Metric label="Bloq. destinacao" value={group.waitingCutItems} tone={group.waitingCutItems > 0 ? "warning" : "neutral"} />
          <Metric label="Prontos DTF" value={group.readyItems} tone={group.readyItems > 0 ? "success" : "neutral"} />
          <Metric label="Andamento" value={group.activeItems} tone={group.activeItems > 0 ? "accent" : "neutral"} />
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-md border border-line bg-white p-3">
          <Metric label="Liberado para DTF" value={group.cutAvailable} />
          <Metric label="DTF feito" value={group.printed} />
        </div>

        <Button type="button" variant="secondary" onClick={onToggle} aria-expanded={expanded}>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          Ver itens
        </Button>
      </div>

      {expanded ? (
        <div className="border-t border-line/70 bg-[#FCFAF6]/70 p-4">
          <div className="space-y-3">
            {group.rows.map((row) => (
              <PrintItemRow
                key={`${row.order.id}-${row.item.id}`}
                row={row}
                onRegister={() => onRegister(row)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function PrintItemRow({ row, onRegister }: { row: PrintRow; onRegister: () => void }) {
  const stage = printStage(row.item);
  const available = availableForPrint(row.item);
  const missingCut = Math.max(row.item.quantity_requested - row.item.quantity_cut, 0);
  const paused = row.order.production_paused;

  return (
    <div className="grid gap-4 rounded-md border border-line bg-white p-4 xl:grid-cols-[1.2fr_1fr_1fr_auto] xl:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">Item {row.itemNumber}</Badge>
          <StageBadge stage={stage} />
          <PriorityBadge priority={row.item.operational_priority} />
          {paused ? <Badge tone="warning">Producao pausada</Badge> : null}
        </div>
        <p className="mt-2 text-sm text-muted">
          <span className="font-bold text-ink">{row.item.product.name}</span> / {row.item.size.label} / {row.item.color || "sem cor"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-md border border-line bg-[#FCFAF6] p-3">
        <Metric label="Destinado para OS" value={row.item.quantity_cut} />
        <Metric label="DTF realizado" value={row.item.quantity_printed} />
        <Metric label="Disponivel para DTF" value={available} tone={available > 0 ? "success" : "warning"} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-ink">{printServiceLabel(row.item)}</p>
        {missingCut > 0 ? (
          <p className="text-xs font-semibold text-warning">Falta destinar {missingCut}</p>
        ) : null}
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent-dark">
          {itemFlowLabel(row.item)}
        </p>
      </div>

      <Button type="button" disabled={available <= 0 || paused} onClick={onRegister}>
        {paused ? "Producao pausada" : "Registrar DTF"}
      </Button>
    </div>
  );
}

function StageBadge({ stage }: { stage: QueueStage }) {
  if (stage === "waiting_cut") return <Badge tone="warning">Aguardando pecas destinadas</Badge>;
  if (stage === "active") return <Badge tone="accent">Em andamento</Badge>;
  if (stage === "ready") return <Badge tone="success">Pronto para DTF</Badge>;
  return <Badge tone="success">Concluido</Badge>;
}

function PriorityBadge({ priority }: { priority: OrderItem["operational_priority"] }) {
  const tone = priority === "critical" ? "danger" : priority === "urgent" ? "warning" : "neutral";
  return <Badge tone={tone}>{priorityLabel(priority)}</Badge>;
}

function stageRank(stage: QueueStage) {
  if (stage === "ready") return 0;
  if (stage === "active") return 1;
  if (stage === "waiting_cut") return 2;
  return 3;
}

function groupStageRank(group: PrintOrderGroup) {
  if (group.readyItems > 0) return 0;
  if (group.activeItems > 0) return 1;
  return 2;
}

function Metric({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "success" | "accent";
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 font-black text-ink",
          tone === "warning" && "text-warning",
          tone === "success" && "text-success",
          tone === "accent" && "text-accent-dark"
        )}
      >
        {value}
      </p>
    </div>
  );
}
