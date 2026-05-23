"use client";

import { ChevronDown, ChevronRight, Clock3, LockKeyhole, RefreshCw, Shirt } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrderDetails, OrderItem, OrderSummary } from "@/components/orders/types";
import {
  buildOperationalQueueItem,
  itemNeedsStage,
  priorityLabel,
  type OperationalQueueItem
} from "@/components/production/helpers";
import { ProductionSewModal } from "@/components/production/ProductionSewModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

type SewTarget = {
  order: OrderDetails;
  item: OrderItem;
};

type SewingBucket = "ready" | "active" | "waiting_print" | "waiting_cut";

type SewingOrderGroup = {
  order: OrderDetails;
  rows: OperationalQueueItem[];
  pendingItems: number;
  readyItems: number;
  activeItems: number;
  waitingPrintItems: number;
  waitingCutItems: number;
  availableForSewing: number;
  sewn: number;
  missingSewing: number;
  priority: OperationalQueueItem["item"]["operational_priority"];
  latestTrace: OperationalQueueItem["traces"][number] | null;
  ageDays: number;
};

const priorityRank = {
  critical: 0,
  urgent: 1,
  normal: 2
};

export function SewingPage() {
  const [orders, setOrders] = useState<OrderDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selected, setSelected] = useState<SewTarget | null>(null);
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
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel carregar a fila de confeccao.");
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
        .filter((row) => itemNeedsStage(row.item, "sew") && row.balances.missingSewing > 0)
        .sort((a, b) => {
          const priorityDiff = priorityRank[a.item.operational_priority] - priorityRank[b.item.operational_priority];
          if (priorityDiff !== 0) return priorityDiff;
          return b.ageDays - a.ageDays || a.order.id - b.order.id;
        }),
    [orders]
  );

  const summary = useMemo(() => {
    const values = { orders: 0, ready: 0, waiting_print: 0, waiting_cut: 0 };
    for (const row of rows) {
      const bucket = sewingBucket(row);
      if (bucket === "ready" || bucket === "active") {
        values.ready += 1;
      } else {
        values[bucket] += 1;
      }
    }
    values.orders = new Set(rows.map((row) => row.order.id)).size;
    return values;
  }, [rows]);

  const orderGroups = useMemo<SewingOrderGroup[]>(() => {
    const grouped = new Map<number, OperationalQueueItem[]>();

    rows.forEach((row) => {
      const groupRows = grouped.get(row.order.id) ?? [];
      groupRows.push(row);
      grouped.set(row.order.id, groupRows);
    });

    return Array.from(grouped.values())
      .map((groupRows) => {
        const sortedRows = [...groupRows].sort((a, b) => {
          const bucketDiff = sewingBucketRank(sewingBucket(a)) - sewingBucketRank(sewingBucket(b));
          if (bucketDiff !== 0) return bucketDiff;

          const priorityDiff = priorityRank[a.item.operational_priority] - priorityRank[b.item.operational_priority];
          if (priorityDiff !== 0) return priorityDiff;

          return b.ageDays - a.ageDays || a.itemNumber - b.itemNumber;
        });
        const buckets = sortedRows.map(sewingBucket);
        const priority = sortedRows.reduce(
          (highest, row) =>
            priorityRank[row.item.operational_priority] < priorityRank[highest]
              ? row.item.operational_priority
              : highest,
          sortedRows[0].item.operational_priority
        );
        const traces = sortedRows
          .flatMap((row) => row.traces)
          .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

        return {
          order: sortedRows[0].order,
          rows: sortedRows,
          pendingItems: sortedRows.length,
          readyItems: buckets.filter((bucket) => bucket === "ready").length,
          activeItems: buckets.filter((bucket) => bucket === "active").length,
          waitingPrintItems: buckets.filter((bucket) => bucket === "waiting_print").length,
          waitingCutItems: buckets.filter((bucket) => bucket === "waiting_cut").length,
          availableForSewing: sortedRows.reduce((total, row) => total + row.balances.availableForSewing, 0),
          sewn: sortedRows.reduce((total, row) => total + row.balances.sewn, 0),
          missingSewing: sortedRows.reduce((total, row) => total + row.balances.missingSewing, 0),
          priority,
          latestTrace: traces[0] ?? null,
          ageDays: Math.max(...sortedRows.map((row) => row.ageDays))
        };
      })
      .sort((a, b) => {
        const stageDiff = groupStageRank(a) - groupStageRank(b);
        if (stageDiff !== 0) return stageDiff;

        const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
        if (priorityDiff !== 0) return priorityDiff;

        return b.ageDays - a.ageDays || a.order.id - b.order.id;
      });
  }, [rows]);

  function handleUpdated(updated: OrderDetails) {
    setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
    setSuccess(`Confeccao registrada na OS #${updated.id}.`);
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
            Fila e registro de confeccao interna por item
          </p>
          <h1 className="mt-1 text-3xl font-black text-ink">Confeccao</h1>
        </div>
        <Button type="button" variant="secondary" onClick={() => void loadOrders()} disabled={loading}>
          <RefreshCw size={16} />
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
        <SummaryTile label="OS na fila" value={summary.orders} />
        <SummaryTile label="Aptos para costurar" value={summary.ready} />
        <SummaryTile label="Aguardando DTF" value={summary.waiting_print} tone="warning" />
        <SummaryTile label="Aguardando corte" value={summary.waiting_cut} tone="warning" />
      </div>

      <section className="space-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Fila de producao</p>
          <h2 className="mt-1 text-xl font-black text-ink">OS com confeccao pendente</h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-lg border border-line bg-white/80" />
            ))}
          </div>
        ) : orderGroups.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<Shirt size={20} />}
                title="Nenhum item aguardando confeccao"
                description="Itens internos aparecem aqui quando ainda existe saldo a costurar."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {orderGroups.map((group) => (
              <SewingOrderCard
                key={group.order.id}
                group={group}
                expanded={expandedOrders.has(group.order.id)}
                onToggle={() => toggleOrder(group.order.id)}
                onRegister={(row) => setSelected({ order: row.order, item: row.item })}
              />
            ))}
          </div>
        )}
      </section>

      <ProductionSewModal
        open={Boolean(selected)}
        order={selected?.order ?? null}
        item={selected?.item ?? null}
        onClose={() => setSelected(null)}
        onUpdated={handleUpdated}
      />
    </div>
  );
}

function SewingOrderCard({
  group,
  expanded,
  onToggle,
  onRegister
}: {
  group: SewingOrderGroup;
  expanded: boolean;
  onToggle: () => void;
  onRegister: (row: OperationalQueueItem) => void;
}) {
  const latest = group.latestTrace;
  const pendingLabel = group.pendingItems === 1 ? "item com confeccao pendente" : "itens com confeccao pendente";

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-4 p-5 xl:grid-cols-[1.15fr_1.25fr_1fr_auto] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-black text-ink">OS #{group.order.id}</span>
            <Badge tone="accent">
              {group.pendingItems} {pendingLabel}
            </Badge>
            <PriorityBadge priority={group.priority} />
          </div>
          <p className="mt-1 text-sm font-semibold text-muted">{group.order.client.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-md border border-line bg-[#FCFAF6] p-3 md:grid-cols-4">
          <Metric label="Liberados" value={group.readyItems + group.activeItems} tone="success" />
          <Metric label="Andamento" value={group.activeItems} tone="accent" />
          <Metric label="Aguard. DTF" value={group.waitingPrintItems} tone="warning" />
          <Metric label="Aguard. corte" value={group.waitingCutItems} tone="warning" />
        </div>

        <div className="grid grid-cols-3 gap-3 rounded-md border border-line bg-white p-3">
          <Metric label="Disponivel" value={group.availableForSewing} tone="success" />
          <Metric label="Costurado" value={group.sewn} />
          <Metric label="Falta" value={group.missingSewing} tone="warning" />
        </div>

        <div className="space-y-3">
          <LatestTrace trace={latest} />
          <Button type="button" variant="secondary" onClick={onToggle} aria-expanded={expanded} className="w-full">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            Ver itens
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-line/70 bg-[#FCFAF6]/70 p-4">
          <div className="space-y-3">
            {group.rows.map((row) => (
              <SewingItemRow
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

function SewingItemRow({
  row,
  onRegister
}: {
  row: OperationalQueueItem;
  onRegister: () => void;
}) {
  const hasPrint = itemNeedsStage(row.item, "print");
  const bucket = sewingBucket(row);
  const canRegister = row.balances.availableForSewing > 0;

  return (
    <div className="grid gap-4 rounded-md border border-line bg-white p-4 xl:grid-cols-[1.2fr_1.3fr_auto] xl:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">Item {row.itemNumber}</Badge>
          <PriorityBadge priority={row.item.operational_priority} />
          <SewingStatusBadge bucket={bucket} />
        </div>
        <p className="mt-2 text-sm text-muted">
          <span className="font-bold text-ink">{row.item.product.name}</span> / {row.item.color || "sem cor"} / Tam. {row.item.size.label}
        </p>
        {row.item.notes ? <p className="mt-2 text-xs text-muted">{row.item.notes}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-md border border-line bg-[#FCFAF6] p-3 md:grid-cols-5">
        <Metric label="Cortado" value={row.balances.cut} />
        <Metric label="DTF" value={hasPrint ? row.balances.printed : 0} muted={!hasPrint} />
        <Metric label="Costurado" value={row.balances.sewn} />
        <Metric label="Disponivel" value={row.balances.availableForSewing} tone="success" />
        <Metric label="Falta" value={row.balances.missingSewing} tone="warning" />
      </div>

      <Button type="button" onClick={onRegister} disabled={!canRegister} variant={canRegister ? "primary" : "secondary"}>
        {canRegister ? <Shirt size={16} /> : <LockKeyhole size={16} />}
        {canRegister ? "Registrar confeccao" : blockedActionLabel(bucket)}
      </Button>
    </div>
  );
}

function LatestTrace({ trace }: { trace: OperationalQueueItem["traces"][number] | null }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Ultima movimentacao</p>
      {trace ? (
        <div className="text-sm">
          <p className="font-semibold text-ink">{trace.label}</p>
          <p className="mt-1 text-xs text-muted">{trace.actor} / {formatDateTime(trace.at)}</p>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm font-semibold text-muted">
          <Clock3 size={15} />
          Sem movimentacao
        </p>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning";
}) {
  return (
    <Card className={cn(tone === "warning" && value > 0 && "border-warning/25 bg-warning/5")}>
      <CardContent>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
        <p className="mt-1 text-2xl font-black text-ink">{value}</p>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
  muted = false
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "warning" | "accent";
  muted?: boolean;
}) {
  return (
    <div className={cn(muted && "opacity-50")}>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 font-black text-ink",
          tone === "success" && value > 0 && "text-success",
          tone === "warning" && value > 0 && "text-warning",
          tone === "accent" && value > 0 && "text-accent-dark"
        )}
      >
        {muted ? "-" : value}
      </p>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: OperationalQueueItem["item"]["operational_priority"] }) {
  const tone = priority === "critical" ? "danger" : priority === "urgent" ? "warning" : "neutral";
  return <Badge tone={tone}>{priorityLabel(priority)}</Badge>;
}

function SewingStatusBadge({ bucket }: { bucket: SewingBucket }) {
  if (bucket === "ready") return <Badge tone="success">Liberado</Badge>;
  if (bucket === "active") return <Badge tone="accent">Em andamento</Badge>;
  if (bucket === "waiting_print") return <Badge tone="warning">Bloqueado aguardando DTF</Badge>;
  return <Badge tone="warning">Bloqueado aguardando corte</Badge>;
}

function sewingBucket(row: OperationalQueueItem): SewingBucket {
  if (row.balances.availableForSewing > 0) return row.balances.sewn > 0 ? "active" : "ready";
  if (itemNeedsStage(row.item, "print") && row.balances.missingPrint > 0) return "waiting_print";
  return "waiting_cut";
}

function blockedActionLabel(bucket: SewingBucket) {
  if (bucket === "waiting_print") return "Aguardando DTF";
  if (bucket === "waiting_cut") return "Aguardando corte";
  return "Registrar confeccao";
}

function sewingBucketRank(bucket: SewingBucket) {
  if (bucket === "ready") return 0;
  if (bucket === "active") return 1;
  if (bucket === "waiting_print") return 2;
  return 3;
}

function groupStageRank(group: SewingOrderGroup) {
  if (group.readyItems > 0) return 0;
  if (group.activeItems > 0) return 1;
  if (group.waitingPrintItems > 0) return 2;
  return 3;
}
