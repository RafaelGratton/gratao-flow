"use client";

import { Clock3, RefreshCw, Scissors } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrderDetails, OrderItem, OrderSummary } from "@/components/orders/types";
import {
  buildOperationalQueueItem,
  priorityLabel,
  type OperationalQueueItem
} from "@/components/production/helpers";
import { ProductionCutModal } from "@/components/production/ProductionCutModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

type CutTarget = {
  order: OrderDetails;
  item: OrderItem;
};

const priorityRank = {
  critical: 0,
  urgent: 1,
  normal: 2
};

export function CuttingPage() {
  const [orders, setOrders] = useState<OrderDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selected, setSelected] = useState<CutTarget | null>(null);

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
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel carregar a fila de corte.");
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
        .filter((row) => row.balances.missingCut > 0)
        .sort((a, b) => {
          const priorityDiff = priorityRank[a.item.operational_priority] - priorityRank[b.item.operational_priority];
          if (priorityDiff !== 0) return priorityDiff;
          return b.ageDays - a.ageDays || a.order.id - b.order.id;
        }),
    [orders]
  );

  function handleUpdated(updated: OrderDetails) {
    setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
    setSuccess(`Corte registrado na OS #${updated.id}.`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
            Fila e registro de corte por item
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

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryTile label="Itens a cortar" value={rows.length} />
        <SummaryTile label="Pecas restantes" value={rows.reduce((total, row) => total + row.balances.missingCut, 0)} />
        <SummaryTile
          label="Criticos"
          value={rows.filter((row) => row.item.operational_priority === "critical").length}
          tone="danger"
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="bg-white/70">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Operacao</p>
            <h2 className="mt-1 text-xl font-black text-ink">Itens com saldo a cortar</h2>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Scissors size={20} />}
                title="Nenhum item aguardando corte"
                description="Itens aparecem aqui quando ainda existe saldo restante a cortar."
              />
            </div>
          ) : (
            <div className="divide-y divide-line/70">
              {rows.map((row) => (
                <CuttingRow
                  key={`${row.order.id}-${row.item.id}`}
                  row={row}
                  onRegister={() => setSelected({ order: row.order, item: row.item })}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ProductionCutModal
        open={Boolean(selected)}
        order={selected?.order ?? null}
        item={selected?.item ?? null}
        onClose={() => setSelected(null)}
        onUpdated={handleUpdated}
      />
    </div>
  );
}

function CuttingRow({ row, onRegister }: { row: OperationalQueueItem; onRegister: () => void }) {
  const latest = row.traces[0];

  return (
    <div className="grid gap-4 p-5 transition hover:bg-accent-soft/25 xl:grid-cols-[1.2fr_1.1fr_1fr_auto] xl:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-black text-ink">OS #{row.order.id}</span>
          <Badge tone="accent">Item {row.itemNumber}</Badge>
          <PriorityBadge priority={row.item.operational_priority} />
          <Badge tone="warning">{row.statusLabel}</Badge>
        </div>
        <p className="mt-1 text-sm font-semibold text-muted">{row.order.client.name}</p>
        <p className="mt-3 text-sm text-muted">
          <span className="font-bold text-ink">{row.item.product.name}</span> / {row.item.color || "sem cor"} / Tam. {row.item.size.label}
        </p>
        {row.item.notes ? <p className="mt-2 text-xs text-muted">{row.item.notes}</p> : null}
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-md border border-line bg-[#FCFAF6] p-3">
        <Metric label="Solicitado" value={row.balances.requested} />
        <Metric label="Ja cortado" value={row.balances.cut} />
        <Metric label="Falta cortar" value={row.balances.missingCut} tone="warning" />
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

      <Button type="button" onClick={onRegister}>
        <Scissors size={16} />
        Registrar corte
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
