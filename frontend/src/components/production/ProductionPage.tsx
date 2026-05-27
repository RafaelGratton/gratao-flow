"use client";

import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Eye,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Scissors,
  Search,
  Shirt,
  Stamp,
  Truck,
  Wrench
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import type {
  OperationalPriority,
  OrderDetails,
  OrderItem,
  OrderSummary
} from "@/components/orders/types";
import {
  buildOperationalQueueItem,
  itemFlowLabel,
  itemNeedsStage,
  priorityLabel,
  type BottleneckKind,
  type OperationalQueueItem,
  type OperationalStatus,
  type ProductionQueueStage
} from "@/components/production/helpers";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

type StageFilter = "all" | ProductionQueueStage;
type PriorityFilter = "all" | OperationalPriority;
type OutsourcingFilter = "all" | "yes" | "no" | "awaiting_return";
type BottleneckFilter = "all" | BottleneckKind | "ready_delivery";

type ItemTarget = {
  order: OrderDetails;
  item: OrderItem;
};

type AuditAction = "loss" | "rework" | "adjustment";

type AuditTarget = ItemTarget & {
  action: AuditAction;
};

type ProductionOrderGroup = {
  order: OrderDetails;
  rows: OperationalQueueItem[];
  priority: OperationalPriority;
  status: OperationalStatus;
  statusLabel: string;
  bottlenecks: BottleneckKind[];
  blockers: string[];
  latestTrace: OperationalQueueItem["traces"][number] | null;
  maxAgeDays: number;
  totals: {
    requested: number;
    cut: number;
    printed: number;
    sewn: number;
    readyForDelivery: number;
    delivered: number;
    awaitingReturn: number;
  };
};

const stageLabels: Record<StageFilter, string> = {
  all: "Todas",
  cut: "Destinacao",
  print: "DTF",
  sew: "Costura",
  outsourcing: "Terceirizacao",
  delivery: "Entrega",
  done: "Concluidas"
};

const statusOptions: Array<{ value: OperationalStatus | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "waiting_cut", label: "Aguardando destinacao" },
  { value: "in_cut", label: "Destinacao parcial" },
  { value: "waiting_print", label: "Aguardando DTF" },
  { value: "in_print", label: "Em DTF" },
  { value: "waiting_sewing", label: "Aguardando costura" },
  { value: "in_sewing", label: "Em costura" },
  { value: "outsourced", label: "Terceirizado" },
  { value: "waiting_return", label: "Aguardando retorno" },
  { value: "partial_ready", label: "Pronto parcial" },
  { value: "ready", label: "Pronto total" },
  { value: "partial_delivered", label: "Entregue parcial" },
  { value: "delivered", label: "Entregue total" }
];

const priorityRank: Record<OperationalPriority, number> = {
  critical: 0,
  urgent: 1,
  normal: 2
};

const statusRelevanceRank: Record<OperationalStatus, number> = {
  blocked: 0,
  waiting_return: 1,
  partial_ready: 2,
  ready: 3,
  partial_delivered: 4,
  in_sewing: 5,
  waiting_sewing: 6,
  in_print: 7,
  waiting_print: 8,
  in_cut: 9,
  waiting_cut: 10,
  outsourced: 11,
  delivered: 12
};

export function ProductionPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [prioritySavingId, setPrioritySavingId] = useState<number | null>(null);
  const [auditTarget, setAuditTarget] = useState<AuditTarget | null>(null);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<number>>(() => new Set());
  const [filters, setFilters] = useState({
    search: "",
    client: "",
    product: "",
    stage: "all" as StageFilter,
    status: "all" as OperationalStatus | "all",
    priority: "all" as PriorityFilter,
    outsourcing: "all" as OutsourcingFilter,
    bottleneck: "all" as BottleneckFilter
  });

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summaries = await api.get<OrderSummary[]>("/orders");
      const openSummaries = summaries.filter((order) => order.production_status !== "cancelled");
      const details = await Promise.all(
        openSummaries.map((order) => api.get<OrderDetails>(`/orders/${order.id}`))
      );
      setOrders(details);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel carregar a producao.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const rows = useMemo(
    () =>
      orders
        .flatMap((order) =>
          order.items.map((item, index) => buildOperationalQueueItem(order, item, index + 1))
        )
        .sort((a, b) => {
          const priorityDiff = priorityRank[a.item.operational_priority] - priorityRank[b.item.operational_priority];
          if (priorityDiff !== 0) return priorityDiff;
          const blockedDiff = Number(b.bottlenecks.length > 0) - Number(a.bottlenecks.length > 0);
          if (blockedDiff !== 0) return blockedDiff;
          return b.ageDays - a.ageDays || a.order.id - b.order.id;
        }),
    [orders]
  );

  const options = useMemo(
    () => ({
      clients: Array.from(new Set(rows.map((row) => row.order.client.name))).sort(),
      products: Array.from(new Set(rows.map((row) => row.item.product.name))).sort()
    }),
    [rows]
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const query = filters.search.trim().toLowerCase();
        if (query && !row.searchText.includes(query)) return false;
        if (filters.client && row.order.client.name !== filters.client) return false;
        if (filters.product && row.item.product.name !== filters.product) return false;
        if (filters.stage !== "all" && row.stage !== filters.stage) return false;
        if (filters.status !== "all" && row.status !== filters.status) return false;
        if (filters.priority !== "all" && row.item.operational_priority !== filters.priority) return false;
        if (filters.outsourcing === "yes" && !itemNeedsStage(row.item, "outsourcing")) return false;
        if (filters.outsourcing === "no" && itemNeedsStage(row.item, "outsourcing")) return false;
        if (filters.outsourcing === "awaiting_return" && row.balances.awaitingReturn <= 0) return false;
        if (filters.bottleneck === "ready_delivery" && row.balances.readyForDelivery <= 0) return false;
        if (filters.bottleneck !== "all" && filters.bottleneck !== "ready_delivery" && !row.bottlenecks.includes(filters.bottleneck)) {
          return false;
        }
        return true;
      }),
    [filters, rows]
  );

  const summary = useMemo(() => {
    return {
      visibleItems: filteredRows.length,
      ready: filteredRows.reduce((total, row) => total + row.balances.readyForDelivery, 0),
      awaitingReturn: filteredRows.reduce((total, row) => total + row.balances.awaitingReturn, 0),
      visibleOrders: 0,
      blockedOrders: 0
    };
  }, [filteredRows]);

  const orderGroups = useMemo(() => {
    const groups = new Map<number, OperationalQueueItem[]>();
    for (const row of filteredRows) {
      const current = groups.get(row.order.id) ?? [];
      current.push(row);
      groups.set(row.order.id, current);
    }

    return Array.from(groups.values())
      .map((groupRows) => buildOrderGroup(groupRows))
      .sort((a, b) => {
        const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        const bottleneckDiff = Number(b.bottlenecks.length > 0) - Number(a.bottlenecks.length > 0);
        if (bottleneckDiff !== 0) return bottleneckDiff;
        return b.maxAgeDays - a.maxAgeDays || a.order.id - b.order.id;
      });
  }, [filteredRows]);

  const groupedSummary = useMemo(
    () => ({
      ...summary,
      visibleOrders: orderGroups.length,
      blockedOrders: orderGroups.filter((group) => group.bottlenecks.length > 0).length
    }),
    [orderGroups, summary]
  );

  function replaceOrder(updated: OrderDetails, message: string) {
    setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
    setSuccess(message);
  }

  async function updatePriority(row: OperationalQueueItem, priority: OperationalPriority) {
    setPrioritySavingId(row.item.id);
    setError(null);
    try {
      const updated = await api.put<OrderDetails>(`/orders/${row.order.id}`, {
        client_id: row.order.client.id,
        allow_printing_exception: row.order.allow_printing_exception,
        notes: row.order.notes,
        items: row.order.items.map((item) => ({
          id: item.id,
          product_id: item.product_id,
          size_id: item.size_id,
          color: item.color,
          quantity_requested: item.quantity_requested,
          operational_priority: item.id === row.item.id ? priority : item.operational_priority,
          sewing_mode: item.sewing_mode,
          notes: item.notes,
          service_ids: item.services.map((service) => service.service_id)
        }))
      });
      replaceOrder(updated, `Prioridade atualizada na OS #${updated.id}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel atualizar a prioridade.");
    } finally {
      setPrioritySavingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
            Painel operacional por OS
          </p>
          <h1 className="mt-1 text-3xl font-black text-ink">Producao</h1>
        </div>
        <Button type="button" variant="secondary" onClick={() => void loadOrders()} disabled={loading}>
          <RefreshCw size={16} />
          Atualizar
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryTile label="OS visiveis" value={groupedSummary.visibleOrders} />
        <SummaryTile label="Itens visiveis" value={groupedSummary.visibleItems} />
        <SummaryTile label="Pronto p/ entrega" value={groupedSummary.ready} tone={groupedSummary.ready > 0 ? "success" : "neutral"} />
        <SummaryTile label="Ag. retorno" value={groupedSummary.awaitingReturn} tone={groupedSummary.awaitingReturn > 0 ? "warning" : "neutral"} />
        <SummaryTile label="Gargalos" value={groupedSummary.blockedOrders} tone={groupedSummary.blockedOrders > 0 ? "danger" : "neutral"} />
      </div>

      <Card>
        <CardContent className="space-y-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input
              className="h-11 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm font-semibold text-ink shadow-insetline transition placeholder:text-muted focus:focus-ring"
              placeholder="Buscar OS, cliente, produto, cor ou observacao"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FilterSelect
              label="Cliente"
              value={filters.client}
              options={options.clients}
              onChange={(client) => setFilters((current) => ({ ...current, client }))}
            />
            <FilterSelect
              label="Produto"
              value={filters.product}
              options={options.products}
              onChange={(product) => setFilters((current) => ({ ...current, product }))}
            />
            <NativeSelect
              label="Etapa"
              value={filters.stage}
              onChange={(value) => setFilters((current) => ({ ...current, stage: value as StageFilter }))}
              options={Object.entries(stageLabels).map(([value, label]) => ({ value, label }))}
            />
            <NativeSelect
              label="Status"
              value={filters.status}
              onChange={(value) => setFilters((current) => ({ ...current, status: value as OperationalStatus | "all" }))}
              options={statusOptions}
            />
            <NativeSelect
              label="Prioridade"
              value={filters.priority}
              onChange={(value) => setFilters((current) => ({ ...current, priority: value as PriorityFilter }))}
              options={[
                { value: "all", label: "Todas" },
                { value: "normal", label: "Normal" },
                { value: "urgent", label: "Urgente" },
                { value: "critical", label: "Critico" }
              ]}
            />
            <NativeSelect
              label="Terceirizacao"
              value={filters.outsourcing}
              onChange={(value) => setFilters((current) => ({ ...current, outsourcing: value as OutsourcingFilter }))}
              options={[
                { value: "all", label: "Todas" },
                { value: "yes", label: "Terceirizados" },
                { value: "no", label: "Nao terceirizados" },
                { value: "awaiting_return", label: "Aguardando retorno" }
              ]}
            />
            <NativeSelect
              label="Gargalo"
              value={filters.bottleneck}
              onChange={(value) => setFilters((current) => ({ ...current, bottleneck: value as BottleneckFilter }))}
              options={[
                { value: "all", label: "Todos" },
                { value: "delayed", label: "Atraso" },
                { value: "stopped", label: "Item parado" },
                { value: "outsourcing_wait", label: "Ag. terceirizacao" },
                { value: "ready_stopped", label: "Pronto parado" },
                { value: "blocked", label: "Travado" },
                { value: "ready_delivery", label: "Pronto para entrega" }
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-lg border border-line bg-white" />
          ))}
        </div>
      ) : orderGroups.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm font-semibold text-muted">Nenhuma OS encontrada para os filtros atuais.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orderGroups.map((group) => (
            <ProductionOrderCard
              key={group.order.id}
              group={group}
              expanded={expandedOrderIds.has(group.order.id)}
              onToggle={() =>
                setExpandedOrderIds((current) => {
                  const next = new Set(current);
                  if (next.has(group.order.id)) {
                    next.delete(group.order.id);
                  } else {
                    next.add(group.order.id);
                  }
                  return next;
                })
              }
              onOpenOrder={() => router.push(`/orders/${group.order.id}`)}
              renderItem={(row) => (
                <ProductionQueueRow
                  key={`${row.order.id}-${row.item.id}`}
                  row={row}
                  prioritySaving={prioritySavingId === row.item.id}
                  onPriorityChange={(priority) => void updatePriority(row, priority)}
                  onOpenOrder={() => router.push(`/orders/${row.order.id}`)}
                  onCut={() => router.push("/cutting")}
                  onPrint={() => router.push("/printing")}
                  onSew={() => router.push("/sewing")}
                  onOutsource={() => router.push("/outsourcing")}
                  onDeliver={() => router.push("/deliveries")}
                  onAudit={(action) => setAuditTarget({ order: row.order, item: row.item, action })}
                />
              )}
            />
          ))}
        </div>
      )}

      <OperationalAuditModal
        target={auditTarget}
        onClose={() => setAuditTarget(null)}
        onUpdated={(order, message) => replaceOrder(order, message)}
        onError={setError}
      />
    </div>
  );
}

function buildOrderGroup(rows: OperationalQueueItem[]): ProductionOrderGroup {
  const relevantRow = [...rows].sort((a, b) => {
    const bottleneckDiff = Number(b.bottlenecks.length > 0) - Number(a.bottlenecks.length > 0);
    if (bottleneckDiff !== 0) return bottleneckDiff;
    const statusDiff = statusRelevanceRank[a.status] - statusRelevanceRank[b.status];
    if (statusDiff !== 0) return statusDiff;
    const priorityDiff = priorityRank[a.item.operational_priority] - priorityRank[b.item.operational_priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.ageDays - a.ageDays;
  })[0];
  const latestTrace =
    rows
      .flatMap((row) => row.traces)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0] ?? null;

  return {
    order: relevantRow.order,
    rows,
    priority: rows.reduce(
      (highest, row) =>
        priorityRank[row.item.operational_priority] < priorityRank[highest]
          ? row.item.operational_priority
          : highest,
      rows[0].item.operational_priority
    ),
    status: relevantRow.status,
    statusLabel: relevantRow.statusLabel,
    bottlenecks: Array.from(new Set(rows.flatMap((row) => row.bottlenecks))),
    blockers: Array.from(new Set(rows.flatMap((row) => row.blockers))),
    latestTrace,
    maxAgeDays: Math.max(...rows.map((row) => row.ageDays)),
    totals: {
      requested: rows.reduce((total, row) => total + row.balances.requested, 0),
      cut: rows.reduce((total, row) => total + row.balances.cut, 0),
      printed: rows.reduce((total, row) => total + row.balances.printed, 0),
      sewn: rows.reduce((total, row) => total + row.balances.sewn, 0),
      readyForDelivery: rows.reduce((total, row) => total + row.balances.readyForDelivery, 0),
      delivered: rows.reduce((total, row) => total + row.balances.delivered, 0),
      awaitingReturn: rows.reduce((total, row) => total + row.balances.awaitingReturn, 0)
    }
  };
}

function ProductionOrderCard({
  group,
  expanded,
  onToggle,
  onOpenOrder,
  renderItem
}: {
  group: ProductionOrderGroup;
  expanded: boolean;
  onToggle: () => void;
  onOpenOrder: () => void;
  renderItem: (row: OperationalQueueItem) => ReactNode;
}) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border bg-white shadow-insetline",
        group.totals.readyForDelivery > 0 && "border-success/25",
        group.totals.readyForDelivery === 0 && group.bottlenecks.length > 0 && "border-danger/20 bg-danger/[0.025]"
      )}
    >
      <div className="space-y-4 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white text-ink shadow-insetline transition hover:border-accent/40 hover:text-accent-dark focus:focus-ring"
                onClick={onToggle}
                aria-label={expanded ? "Ocultar itens da OS" : "Ver itens da OS"}
              >
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <span className="text-lg font-black text-ink">OS #{group.order.id}</span>
              <StatusPill status={group.status} label={group.statusLabel} />
              <Badge tone={group.priority === "critical" ? "danger" : group.priority === "urgent" ? "warning" : "neutral"}>
                {priorityLabel(group.priority)}
              </Badge>
              {group.order.production_paused ? <Badge tone="warning">Producao pausada</Badge> : null}
            </div>
            <div>
              <p className="text-sm font-black text-ink">{group.order.client.name}</p>
              <p className="mt-1 text-xs font-semibold text-muted">
                {group.rows.length} {group.rows.length === 1 ? "item visivel" : "itens visiveis"} pelos filtros
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={onOpenOrder}>
              <Eye size={14} />
              OS
            </Button>
            <Button type="button" className="h-9 px-3 text-xs" variant="secondary" onClick={onToggle}>
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {expanded ? "Ocultar itens" : "Ver itens"}
            </Button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <OrderMetric label="Solicitado" value={group.totals.requested} />
          <OrderMetric label="Destinado" value={group.totals.cut} />
          <OrderMetric label="DTF" value={group.totals.printed} />
          <OrderMetric label="Costura" value={group.totals.sewn} />
          <OrderMetric label="Pronto entrega" value={group.totals.readyForDelivery} tone="success" />
          <OrderMetric label="Entregue" value={group.totals.delivered} />
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_minmax(260px,1fr)]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted">Gargalos e alertas</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {group.bottlenecks.length === 0 && group.blockers.length === 0 ? <Badge tone="success">Sem gargalo</Badge> : null}
              {group.bottlenecks.map((bottleneck) => (
                <BottleneckBadge key={bottleneck} bottleneck={bottleneck} />
              ))}
              {group.blockers.slice(0, 4).map((blocker) => (
                <AlertChip key={blocker} label={blocker} positive={group.totals.readyForDelivery > 0 && blocker.includes("pronto")} />
              ))}
              {group.blockers.length > 4 ? <Badge tone="warning">+{group.blockers.length - 4} alertas</Badge> : null}
            </div>
          </div>
          <LatestMovement latest={group.latestTrace} />
        </div>
      </div>

      {expanded ? (
        <div className="space-y-3 border-t border-line bg-[#FCFAF6]/70 p-3">
          {group.rows.map((row) => renderItem(row))}
        </div>
      ) : null}
    </article>
  );
}

function OrderMetric({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-line bg-white px-3 py-2 shadow-insetline",
        tone === "success" && value > 0 && "border-success/20 bg-success/10",
        tone === "warning" && value > 0 && "border-warning/25 bg-warning/10"
      )}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className="mt-1 text-lg font-black text-ink">{value}</p>
    </div>
  );
}

function LatestMovement({ latest }: { latest: ProductionOrderGroup["latestTrace"] }) {
  return (
    <div className="rounded-md border border-line bg-white p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted">Ultima movimentacao</p>
      {latest ? (
        <div className="mt-2">
          <p className="font-semibold text-ink">{latest.label}</p>
          <p className="mt-1 text-xs text-muted">
            {latest.actor} / {formatDateTime(latest.at)}
          </p>
          {latest.notes ? <p className="mt-1 text-xs text-muted">{latest.notes}</p> : null}
        </div>
      ) : (
        <p className="mt-2 text-xs font-semibold text-muted">Sem movimentacao</p>
      )}
    </div>
  );
}

function ProductionQueueRow({
  row,
  prioritySaving,
  onPriorityChange,
  onOpenOrder,
  onCut,
  onPrint,
  onSew,
  onOutsource,
  onDeliver,
  onAudit
}: {
  row: OperationalQueueItem;
  prioritySaving: boolean;
  onPriorityChange: (priority: OperationalPriority) => void;
  onOpenOrder: () => void;
  onCut: () => void;
  onPrint: () => void;
  onSew: () => void;
  onOutsource: () => void;
  onDeliver: () => void;
  onAudit: (action: AuditAction) => void;
}) {
  const latest = row.traces[0];
  const hasOperationalAttention = row.blockers.length > 0 || row.bottlenecks.length > 0;
  const paused = row.order.production_paused;
  return (
    <article
      className={cn(
        "rounded-lg border bg-white shadow-insetline",
        row.balances.readyForDelivery > 0 && "border-success/25",
        row.balances.readyForDelivery === 0 && row.bottlenecks.length > 0 && "border-danger/20 bg-danger/[0.025]"
      )}
    >
      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(260px,0.9fr)_minmax(320px,1.2fr)_minmax(260px,0.9fr)_220px]">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">Item {row.itemNumber}</Badge>
            <StatusPill status={row.status} label={row.statusLabel} />
            {paused ? <Badge tone="warning">Producao pausada</Badge> : null}
          </div>
          <div>
            <p className="text-sm font-black text-ink">{row.item.product.name}</p>
            <p className="mt-1 text-xs font-semibold text-muted">
              Tam. {row.item.size.label} / Cor {row.item.color || "sem cor"}
            </p>
            {row.item.notes ? <p className="mt-2 text-xs text-muted">{row.item.notes}</p> : null}
          </div>
          <p className="text-xs font-semibold leading-5 text-muted">Fluxo: {itemFlowLabel(row.item)}</p>
          {row.status === "partial_delivered" ? <PartialDeliverySummary row={row} /> : null}
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-2 rounded-md border border-accent/20 bg-accent-soft/70 p-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-accent-dark">Proxima acao</p>
              <p className="mt-1 flex items-center gap-2 text-lg font-black text-accent-dark">
                <ArrowRight size={18} />
                {paused ? "PRODUCAO PAUSADA" : row.nextAction}
              </p>
            </div>
            <div className="text-xs font-semibold text-muted md:text-right">
              <p>{row.agingLabel}</p>
              <p>Prazo: {row.dueLabel}</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <BalanceGroup title="Ja aconteceu">
              <BalanceLine label="Solicitado" value={row.balances.requested} />
              <BalanceLine label="Destinado" value={row.balances.cut} />
              <BalanceLine label="DTF" value={row.balances.printed} />
              <BalanceLine label="Costurado" value={row.balances.sewn} />
              <BalanceLine label="Entregue" value={row.balances.delivered} />
            </BalanceGroup>
            <BalanceGroup title="Saldo restante">
              <BalanceLine label="Disponivel p/ entrega" value={row.balances.readyForDelivery} tone="success" />
              <BalanceLine label="Ainda em producao" value={row.balances.remainingInProduction} tone="warning" />
              <BalanceLine label="Falta entregar" value={row.balances.remainingToDeliver} />
              <BalanceLine label="Falta destinar" value={row.balances.missingCut} />
              <BalanceLine label="Falta DTF" value={row.balances.missingPrint} />
              <BalanceLine label="Disponivel p/ costura" value={row.balances.availableForSewing} />
              <BalanceLine label="Falta costurar" value={row.balances.missingSewing} />
            </BalanceGroup>
          </div>

          {itemNeedsStage(row.item, "outsourcing") ? (
            <div className="grid gap-2 rounded-md border border-line bg-[#FCFAF6] p-3 text-sm md:grid-cols-3">
              <BalanceLine label="Apto terceirizar" value={row.balances.readyForOutsourcing} />
              <BalanceLine label="Terceirizado" value={row.balances.outsourced} />
              <BalanceLine label="Aguardando retorno" value={row.balances.awaitingReturn} tone="warning" />
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted">Alertas operacionais</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {!hasOperationalAttention ? <Badge tone="success">Sem gargalo</Badge> : null}
              {row.bottlenecks.map((bottleneck) => (
                <BottleneckBadge key={bottleneck} bottleneck={bottleneck} />
              ))}
              {row.blockers.map((blocker) => (
                <AlertChip key={blocker} label={blocker} positive={row.balances.readyForDelivery > 0 && blocker.includes("pronto")} />
              ))}
            </div>
          </div>

          <div className="rounded-md border border-line bg-white p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted">Ultima movimentacao</p>
            {latest ? (
              <div className="mt-2">
                <p className="font-semibold text-ink">{latest.label}</p>
                <p className="mt-1 text-xs text-muted">
                  {latest.actor} / {formatDateTime(latest.at)}
                </p>
                {latest.notes ? <p className="mt-1 text-xs text-muted">{latest.notes}</p> : null}
              </div>
            ) : (
              <p className="mt-2 text-xs font-semibold text-muted">Sem movimentacao</p>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-muted">Prioridade</span>
            <select
              className={cn(
                "h-10 w-full rounded-md border px-2 text-xs font-black shadow-insetline transition focus:focus-ring disabled:opacity-60",
                priorityClass(row.item.operational_priority)
              )}
              value={row.item.operational_priority}
              onChange={(event) => onPriorityChange(event.target.value as OperationalPriority)}
              disabled={prioritySaving}
            >
              <option value="normal">Normal</option>
              <option value="urgent">Urgente</option>
              <option value="critical">Critico</option>
            </select>
          </label>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted">Atalhos</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <MiniAction icon={<Eye size={14} />} label="OS" onClick={onOpenOrder} />
              {row.balances.readyForDelivery > 0 ? (
                <MiniAction icon={<Truck size={14} />} label="Entregas" onClick={onDeliver} disabled={paused} />
              ) : null}
              {row.balances.missingCut > 0 ? (
                <MiniAction icon={<Scissors size={14} />} label="Corte/Dest." onClick={onCut} disabled={paused} />
              ) : null}
              {itemNeedsStage(row.item, "print") && row.balances.missingPrint > 0 ? (
                <MiniAction icon={<Stamp size={14} />} label="DTF" onClick={onPrint} disabled={paused} />
              ) : null}
              {itemNeedsStage(row.item, "sew") && row.balances.missingSewing > 0 ? (
                <MiniAction icon={<Shirt size={14} />} label="Confeccao" onClick={onSew} disabled={paused} />
              ) : null}
              {itemNeedsStage(row.item, "outsourcing") && row.balances.readyForOutsourcing > 0 ? (
                <MiniAction icon={<PackageCheck size={14} />} label="Terc." onClick={onOutsource} disabled={paused} />
              ) : null}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted">Auditoria</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <MiniAction icon={<AlertTriangle size={14} />} label="Perda" onClick={() => onAudit("loss")} disabled={paused} />
              <MiniAction icon={<RotateCcw size={14} />} label="Retrab." onClick={() => onAudit("rework")} disabled={paused} />
              <MiniAction icon={<Wrench size={14} />} label="Ajuste" onClick={() => onAudit("adjustment")} disabled={paused} />
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}

function OperationalAuditModal({
  target,
  onClose,
  onUpdated,
  onError
}: {
  target: AuditTarget | null;
  onClose: () => void;
  onUpdated: (order: OrderDetails, message: string) => void;
  onError: (message: string | null) => void;
}) {
  const [stage, setStage] = useState("cut");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setStage("cut");
      setQuantity("");
      setReason("");
      setNotes("");
    }
  }, [target]);

  if (!target) return null;

  const title =
    target.action === "loss"
      ? "Registrar perda"
      : target.action === "rework"
        ? "Registrar retrabalho"
        : "Registrar ajuste";
  const quantityLabel = target.action === "adjustment" ? "Delta de quantidade" : "Quantidade";

  async function submit() {
    if (!target) return;
    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity === 0 || (target.action !== "adjustment" && parsedQuantity < 1)) {
      onError("Informe uma quantidade valida.");
      return;
    }
    if (!reason.trim() || (target.action === "adjustment" && !notes.trim())) {
      onError("Informe motivo e observacao para registrar auditoria.");
      return;
    }

    setSaving(true);
    onError(null);
    try {
      const body =
        target.action === "adjustment"
          ? {
              stage,
              quantity_delta: parsedQuantity,
              reason: reason.trim(),
              notes: notes.trim()
            }
          : {
              stage,
              quantity: parsedQuantity,
              reason: reason.trim(),
              notes: notes.trim() || null
            };
      const updated = await api.post<OrderDetails>(
        `/orders/${target.order.id}/items/${target.item.id}/${target.action}`,
        body
      );
      onUpdated(updated, `${title} registrado na OS #${updated.id}.`);
      onClose();
    } catch (requestError) {
      onError(requestError instanceof Error ? requestError.message : "Nao foi possivel registrar auditoria.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <div className="w-full max-w-lg rounded-lg border border-line bg-white shadow-soft">
        <div className="border-b border-line px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-dark">
            OS #{target.order.id} - {target.item.product.name} tamanho {target.item.size.label}
          </p>
          <h2 className="mt-1 text-lg font-black text-ink">{title}</h2>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-ink">Etapa</span>
              <select
                className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
                value={stage}
                onChange={(event) => setStage(event.target.value)}
              >
                <option value="cut">Corte</option>
                <option value="print">DTF/serigrafia</option>
                <option value="sew">Confeccao</option>
                {target.action !== "adjustment" ? <option value="outsourcing">Terceirizacao</option> : null}
                {target.action !== "adjustment" ? <option value="outsourcing_return">Retorno</option> : null}
                <option value="delivered">Entrega</option>
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-ink">{quantityLabel}</span>
              <input
                className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
                type="number"
                step="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
          </div>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Motivo</span>
            <input
              className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Observacao</span>
            <textarea
              className="min-h-24 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink shadow-insetline transition focus:focus-ring"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" isLoading={saving} onClick={submit}>
              Registrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PartialDeliverySummary({ row }: { row: OperationalQueueItem }) {
  return (
    <div className="mt-2 space-y-1 text-xs font-semibold leading-4 text-muted">
      <p>{row.balances.delivered} entregues de {row.balances.requested}</p>
      <p>{row.balances.readyForDelivery} disponiveis p/ entrega</p>
      <p>{row.balances.remainingInProduction} ainda em producao</p>
    </div>
  );
}

function SummaryTile({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "success" | "warning" | "danger" }) {
  return (
    <div className={cn("rounded-lg border bg-white p-3 shadow-insetline", tone === "danger" && "border-danger/25 bg-danger/5", tone === "warning" && "border-warning/25 bg-warning/5", tone === "success" && "border-success/25 bg-success/5")}>
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-1 text-2xl font-black text-ink">{value}</p>
    </div>
  );
}

function BalanceGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-white p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted">{title}</p>
      <div className="mt-2 space-y-1">{children}</div>
    </div>
  );
}

function BalanceLine({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "success" | "warning" }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="min-w-0 text-muted">{label}</span>
      <span
        className={cn(
          "rounded border border-line bg-[#FCFAF6] px-2 py-0.5 text-sm font-black text-ink",
          tone === "success" && value > 0 && "border-success/20 bg-success/10 text-success",
          tone === "warning" && value > 0 && "border-warning/25 bg-warning/10 text-warning"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function AlertChip({ label, positive }: { label: string; positive?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold",
        positive ? "border-success/20 bg-success/10 text-success" : "border-warning/20 bg-warning/10 text-warning"
      )}
    >
      {label}
    </span>
  );
}

function StatusPill({ status, label }: { status: OperationalStatus; label: string }) {
  const tone =
    status === "delivered" || status === "ready"
      ? "success"
      : status === "blocked" || status === "waiting_return"
        ? "danger"
        : status.startsWith("waiting") || status === "partial_ready" || status === "partial_delivered"
          ? "warning"
          : "accent";
  return <Badge tone={tone}>{label}</Badge>;
}

function BottleneckBadge({ bottleneck }: { bottleneck: BottleneckKind }) {
  const label: Record<BottleneckKind, string> = {
    delayed: "Atraso",
    stopped: "Parado",
    outsourcing_wait: "Ag. terc.",
    ready_stopped: "Pronto parado",
    blocked: "Travado"
  };
  return (
    <Badge tone={bottleneck === "blocked" || bottleneck === "delayed" ? "danger" : "warning"}>
      <AlertTriangle size={12} />
      {label[bottleneck]}
    </Badge>
  );
}

function MiniAction({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Button type="button" className="h-8 px-2 text-xs" variant="secondary" onClick={onClick} disabled={disabled}>
      {icon}
      {label}
    </Button>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <NativeSelect
      label={label}
      value={value}
      onChange={onChange}
      options={[{ value: "", label: "Todos" }, ...options.map((option) => ({ value: option, label: option }))]}
    />
  );
}

function NativeSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <select
        className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function priorityClass(priority: OperationalPriority) {
  if (priority === "critical") return "border-danger/30 bg-danger/10 text-danger";
  if (priority === "urgent") return "border-warning/30 bg-warning/10 text-warning";
  return "border-line bg-white text-ink";
}
