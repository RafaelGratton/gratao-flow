"use client";

import { Clock3, LockKeyhole, RefreshCw, Shirt } from "lucide-react";
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
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

type SewTarget = {
  order: OrderDetails;
  item: OrderItem;
};

type SewingBucket = "ready" | "waiting_print" | "waiting_cut";

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

  const grouped = useMemo(() => {
    const buckets: Record<SewingBucket, OperationalQueueItem[]> = {
      ready: [],
      waiting_print: [],
      waiting_cut: []
    };

    for (const row of rows) {
      buckets[sewingBucket(row)].push(row);
    }

    return buckets;
  }, [rows]);

  function handleUpdated(updated: OrderDetails) {
    setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
    setSuccess(`Confeccao registrada na OS #${updated.id}.`);
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

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryTile label="Aptos para costurar" value={grouped.ready.length} />
        <SummaryTile label="Aguardando DTF" value={grouped.waiting_print.length} tone="warning" />
        <SummaryTile label="Aguardando corte" value={grouped.waiting_cut.length} tone="warning" />
      </div>

      {loading ? (
        <Card>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
            ))}
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
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
        <div className="space-y-5">
          <SewingSection
            title="Aptos para costurar"
            description="Saldo liberado pela etapa anterior e ainda nao costurado."
            rows={grouped.ready}
            actionLabel="Registrar confeccao"
            onRegister={(row) => setSelected({ order: row.order, item: row.item })}
          />
          <SewingSection
            title="Bloqueados aguardando DTF"
            description="Itens internos que ainda precisam de DTF antes da confeccao."
            rows={grouped.waiting_print}
            actionLabel="Aguardando DTF"
          />
          <SewingSection
            title="Bloqueados aguardando corte"
            description="Itens internos que ainda precisam liberar saldo de corte."
            rows={grouped.waiting_cut}
            actionLabel="Aguardando corte"
          />
        </div>
      )}

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

function SewingSection({
  title,
  description,
  rows,
  actionLabel,
  onRegister
}: {
  title: string;
  description: string;
  rows: OperationalQueueItem[];
  actionLabel: string;
  onRegister?: (row: OperationalQueueItem) => void;
}) {
  if (rows.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-white/70">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">{title}</p>
          <p className="mt-1 text-sm font-semibold text-muted">{description}</p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-line/70">
          {rows.map((row) => (
            <SewingRow
              key={`${row.order.id}-${row.item.id}`}
              row={row}
              actionLabel={actionLabel}
              onRegister={onRegister ? () => onRegister(row) : undefined}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SewingRow({
  row,
  actionLabel,
  onRegister
}: {
  row: OperationalQueueItem;
  actionLabel: string;
  onRegister?: () => void;
}) {
  const latest = row.traces[0];
  const hasPrint = itemNeedsStage(row.item, "print");

  return (
    <div className="grid gap-4 p-5 transition hover:bg-accent-soft/25 xl:grid-cols-[1.2fr_1.3fr_1fr_auto] xl:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-black text-ink">OS #{row.order.id}</span>
          <Badge tone="accent">Item {row.itemNumber}</Badge>
          <PriorityBadge priority={row.item.operational_priority} />
          <Badge tone={onRegister ? "success" : "warning"}>{onRegister ? "Liberado" : row.statusLabel}</Badge>
        </div>
        <p className="mt-1 text-sm font-semibold text-muted">{row.order.client.name}</p>
        <p className="mt-3 text-sm text-muted">
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

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Ultima movimentacao</p>
        {latest ? (
          <div className="text-sm">
            <p className="font-semibold text-ink">{latest.label}</p>
            <p className="mt-1 text-xs text-muted">{latest.actor} / {formatDateTime(latest.at)}</p>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm font-semibold text-muted">
            <Clock3 size={15} />
            Sem movimentacao
          </p>
        )}
      </div>

      <Button type="button" onClick={onRegister} disabled={!onRegister} variant={onRegister ? "primary" : "secondary"}>
        {onRegister ? <Shirt size={16} /> : <LockKeyhole size={16} />}
        {actionLabel}
      </Button>
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
  tone?: "neutral" | "success" | "warning";
  muted?: boolean;
}) {
  return (
    <div className={cn(muted && "opacity-50")}>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 font-black text-ink",
          tone === "success" && value > 0 && "text-success",
          tone === "warning" && value > 0 && "text-warning"
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

function sewingBucket(row: OperationalQueueItem): SewingBucket {
  if (row.balances.availableForSewing > 0) return "ready";
  if (itemNeedsStage(row.item, "print") && row.balances.missingPrint > 0) return "waiting_print";
  return "waiting_cut";
}
