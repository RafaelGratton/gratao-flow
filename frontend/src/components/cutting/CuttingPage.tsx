"use client";

import { ChevronDown, ChevronRight, Clock3, RefreshCw, Scissors } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrderDetails, OrderItem, OrderSummary } from "@/components/orders/types";
import type { StockItem } from "@/components/stock/types";
import {
  activeOrderItems,
  buildOperationalQueueItem,
  itemHasService,
  priorityLabel,
  type OperationalQueueItem
} from "@/components/production/helpers";
import { AllocateCutPiecesModal } from "@/components/cutting/AllocateCutPiecesModal";
import { ProductionCutModal } from "@/components/production/ProductionCutModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

type CutTarget = {
  order: OrderDetails;
  item: OrderItem;
  availableStock: number;
};

type CuttingQueueItem = OperationalQueueItem & {
  availableStock: number;
};

type CuttingOrderGroup = {
  order: OrderDetails;
  rows: CuttingQueueItem[];
  requested: number;
  cut: number;
  missingCut: number;
  priority: OperationalQueueItem["item"]["operational_priority"];
  latestTrace: OperationalQueueItem["traces"][number] | null;
  ageDays: number;
};

const priorityRank = {
  critical: 0,
  urgent: 1,
  normal: 2
};

export function CuttingPage() {
  const [orders, setOrders] = useState<OrderDetails[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedCut, setSelectedCut] = useState<CutTarget | null>(null);
  const [selectedAllocation, setSelectedAllocation] = useState<CutTarget | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(() => new Set());

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaries, pieces] = await Promise.all([
        api.get<OrderSummary[]>("/orders"),
        api.get<StockItem[]>("/stock/items")
      ]);
      const openSummaries = summaries.filter(
        (order) => !["cancelled", "delivered"].includes(order.production_status)
      );
      const details = await Promise.all(
        openSummaries.map((order) => api.get<OrderDetails>(`/orders/${order.id}`))
      );
      setOrders(details);
      setStockItems(pieces.filter((item) => item.category === "piece"));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel carregar a fila de corte.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const itemRows = useMemo(
    () =>
      orders
        .flatMap((order) =>
          activeOrderItems(order).map((item, index) => ({
            ...buildOperationalQueueItem(order, item, index + 1),
            availableStock: compatibleStockBalance(stockItems, item)
          }))
        )
        .filter((row) => row.balances.missingCut > 0)
        .sort((a, b) => {
          const priorityDiff = priorityRank[a.item.operational_priority] - priorityRank[b.item.operational_priority];
          if (priorityDiff !== 0) return priorityDiff;
          return b.ageDays - a.ageDays || a.order.id - b.order.id;
        }),
    [orders, stockItems]
  );

  const orderGroups = useMemo<CuttingOrderGroup[]>(() => {
    const grouped = new Map<number, CuttingQueueItem[]>();

    itemRows.forEach((row) => {
      const groupRows = grouped.get(row.order.id) ?? [];
      groupRows.push(row);
      grouped.set(row.order.id, groupRows);
    });

    return Array.from(grouped.values())
      .map((groupRows) => {
        const sortedRows = [...groupRows].sort((a, b) => {
          const priorityDiff = priorityRank[a.item.operational_priority] - priorityRank[b.item.operational_priority];
          if (priorityDiff !== 0) return priorityDiff;
          return b.ageDays - a.ageDays || a.itemNumber - b.itemNumber;
        });
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
          requested: sortedRows.reduce((total, row) => total + row.balances.requested, 0),
          cut: sortedRows.reduce((total, row) => total + row.balances.cut, 0),
          missingCut: sortedRows.reduce((total, row) => total + row.balances.missingCut, 0),
          priority,
          latestTrace: traces[0] ?? null,
          ageDays: Math.max(...sortedRows.map((row) => row.ageDays))
        };
      })
      .sort((a, b) => {
        const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.ageDays - a.ageDays || a.order.id - b.order.id;
      });
  }, [itemRows]);

  function handleCutUpdated(updated: OrderDetails) {
    setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
    setSuccess("Corte registrado. As pecas foram adicionadas ao estoque.");
    void loadOrders();
  }

  function handleAllocationUpdated(updated: OrderDetails) {
    setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
    setSuccess("Pecas destinadas para a OS com sucesso.");
    void loadOrders();
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
            Registro de corte para estoque por item
          </p>
          <h1 className="mt-1 text-3xl font-black text-ink">Corte</h1>
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
        <SummaryTile label="OS na fila" value={orderGroups.length} />
        <SummaryTile label="Itens sem destinacao completa" value={itemRows.length} />
        <SummaryTile label="Falta destinar" value={orderGroups.reduce((total, group) => total + group.missingCut, 0)} />
        <SummaryTile
          label="Criticos"
          value={orderGroups.filter((group) => group.priority === "critical").length}
          tone="danger"
        />
      </div>

      <section className="space-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Operacao</p>
          <h2 className="mt-1 text-xl font-black text-ink">OS com saldo a destinar</h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-lg border border-line bg-white/80" />
            ))}
          </div>
        ) : orderGroups.length === 0 ? (
          <EmptyState
            icon={<Scissors size={20} />}
            title="Nenhuma OS aguardando destinacao"
            description="OS aparecem aqui quando possuem pelo menos um item com saldo restante a destinar."
          />
        ) : (
          <div className="space-y-3">
            {orderGroups.map((group) => (
              <CuttingOrderCard
                key={group.order.id}
                group={group}
                expanded={expandedOrders.has(group.order.id)}
                onToggle={() => toggleOrder(group.order.id)}
                onRegister={(row) =>
                  setSelectedCut({ order: row.order, item: row.item, availableStock: row.availableStock })
                }
                onAllocate={(row) =>
                  setSelectedAllocation({ order: row.order, item: row.item, availableStock: row.availableStock })
                }
              />
            ))}
          </div>
        )}
      </section>

      <ProductionCutModal
        open={Boolean(selectedCut)}
        order={selectedCut?.order ?? null}
        item={selectedCut?.item ?? null}
        availableStock={selectedCut?.availableStock ?? null}
        onClose={() => setSelectedCut(null)}
        onUpdated={handleCutUpdated}
      />
      <AllocateCutPiecesModal
        open={Boolean(selectedAllocation)}
        order={selectedAllocation?.order ?? null}
        item={selectedAllocation?.item ?? null}
        availableStock={selectedAllocation?.availableStock ?? 0}
        onClose={() => setSelectedAllocation(null)}
        onUpdated={handleAllocationUpdated}
      />
    </div>
  );
}

function CuttingOrderCard({
  group,
  expanded,
  onToggle,
  onRegister,
  onAllocate
}: {
  group: CuttingOrderGroup;
  expanded: boolean;
  onToggle: () => void;
  onRegister: (row: CuttingQueueItem) => void;
  onAllocate: (row: CuttingQueueItem) => void;
}) {
  const latest = group.latestTrace;
  const itemCount = group.rows.length;

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-4 p-5 xl:grid-cols-[1.15fr_1.1fr_1fr_auto] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-black text-ink">OS #{group.order.id}</span>
            <Badge tone="accent">
              {itemCount} {itemCount === 1 ? "item pendente" : "itens pendentes"}
            </Badge>
            <PriorityBadge priority={group.priority} />
            {group.order.production_paused ? <Badge tone="warning">Producao pausada</Badge> : null}
          </div>
          <p className="mt-1 text-sm font-semibold text-muted">{group.order.client.name}</p>
        </div>

        <div className="grid grid-cols-3 gap-3 rounded-md border border-line bg-[#FCFAF6] p-3">
          <Metric label="Solicitado" value={group.requested} />
          <Metric label="Destinado para a OS" value={group.cut} />
          <Metric label="Falta destinar" value={group.missingCut} tone="warning" />
        </div>

        <LatestTrace trace={latest} />

        <Button type="button" variant="secondary" onClick={onToggle} aria-expanded={expanded}>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          Ver itens
        </Button>
      </div>

      {expanded ? (
        <div className="border-t border-line/70 bg-[#FCFAF6]/70 p-4">
          <div className="space-y-3">
            {group.rows.map((row) => (
              <CuttingItemRow
                key={`${row.order.id}-${row.item.id}`}
                row={row}
                onRegister={() => onRegister(row)}
                onAllocate={() => onAllocate(row)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function CuttingItemRow({
  row,
  onRegister,
  onAllocate
}: {
  row: CuttingQueueItem;
  onRegister: () => void;
  onAllocate: () => void;
}) {
  const paused = row.order.production_paused;
  const canAllocate = !paused && row.availableStock > 0 && row.balances.missingCut > 0;
  const canRegisterCut = itemHasService(row.item, "corte");

  return (
    <div className="grid gap-4 rounded-md border border-line bg-white p-4 xl:grid-cols-[1.1fr_1.25fr_auto] xl:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">Item {row.itemNumber}</Badge>
          <PriorityBadge priority={row.item.operational_priority} />
          <Badge tone="warning">{row.statusLabel}</Badge>
          {paused ? <Badge tone="warning">Producao pausada</Badge> : null}
        </div>
        <p className="mt-2 text-sm text-muted">
          <span className="font-bold text-ink">{row.item.product.name}</span> / {row.item.color || "sem cor"} / Tam. {row.item.size.label}
        </p>
        {row.item.notes ? <p className="mt-2 text-xs text-muted">{row.item.notes}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-md border border-line bg-[#FCFAF6] p-3 md:grid-cols-4">
        <Metric label="Solicitado" value={row.balances.requested} />
        <Metric label="Destinado para a OS" value={row.balances.cut} />
        <Metric label="Falta destinar" value={row.balances.missingCut} tone="warning" />
        <Metric
          label={row.availableStock > 0 ? "Disponivel em estoque" : "Sem saldo disponivel"}
          value={row.availableStock}
        />
      </div>

      <div className="flex flex-col gap-2">
        {canRegisterCut ? (
          <Button type="button" onClick={onRegister} disabled={paused}>
            <Scissors size={16} />
            Registrar corte para estoque
          </Button>
        ) : null}
        <Button
          type="button"
          variant={canAllocate ? "secondary" : "ghost"}
          onClick={onAllocate}
          disabled={!canAllocate}
        >
          Destinar pecas
        </Button>
      </div>
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
  tone?: "neutral" | "danger";
}) {
  return (
    <Card className={cn(tone === "danger" && value > 0 && "border-danger/25 bg-danger/5")}>
      <CardContent>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
        <p className="mt-1 text-2xl font-black text-ink">{value}</p>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "warning" }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className={cn("mt-1 font-black text-ink", tone === "warning" && value > 0 && "text-warning")}>{value}</p>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: OperationalQueueItem["item"]["operational_priority"] }) {
  const tone = priority === "critical" ? "danger" : priority === "urgent" ? "warning" : "neutral";
  return <Badge tone={tone}>{priorityLabel(priority)}</Badge>;
}

function compatibleStockBalance(items: StockItem[], item: OrderItem) {
  return items
    .filter(
      (stockItem) =>
        stockItem.product_id === item.product_id &&
        stockItem.size_id === item.size_id &&
        stockItem.color === item.color
    )
    .reduce((total, stockItem) => total + Number(stockItem.quantity), 0);
}
