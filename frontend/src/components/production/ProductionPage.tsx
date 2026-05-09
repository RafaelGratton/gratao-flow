"use client";

import { ArrowRight, RefreshCw, Scissors, Shirt, Stamp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderDetails, OrderItem, OrderSummary } from "@/components/orders/types";
import { PrintActionModal } from "@/components/printing/PrintActionModal";
import {
  flowStageOptions,
  itemFlowLabel,
  itemNeedsStage,
  itemStageDone,
  missingCut,
  relevantStage
} from "@/components/production/helpers";
import { ProductionCutModal } from "@/components/production/ProductionCutModal";
import { ProductionSewModal } from "@/components/production/ProductionSewModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { api } from "@/lib/api";

type StageFilter = "all" | "cut" | "print" | "sew" | "outsourcing" | "done";

type ItemTarget = {
  order: OrderDetails;
  item: OrderItem;
};

const stageLabels: Record<StageFilter, string> = {
  all: "Todas",
  cut: "Corte",
  print: "Serigrafia",
  sew: "Confeccao",
  outsourcing: "Terceirizacao",
  done: "Concluidas"
};

export function ProductionPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cutTarget, setCutTarget] = useState<ItemTarget | null>(null);
  const [printTarget, setPrintTarget] = useState<ItemTarget | null>(null);
  const [sewTarget, setSewTarget] = useState<ItemTarget | null>(null);
  const [filters, setFilters] = useState({
    client: "",
    product: "",
    size: "",
    stage: "all" as StageFilter
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
      orders.flatMap((order) =>
        order.items.map((item, index) => ({
          order,
          item,
          itemNumber: index + 1,
          stage: ["ready", "delivered"].includes(order.production_status) ? "done" : relevantStage(item)
        }))
      ),
    [orders]
  );

  const options = useMemo(
    () => ({
      clients: Array.from(new Set(rows.map((row) => row.order.client.name))).sort(),
      products: Array.from(new Set(rows.map((row) => row.item.product.name))).sort(),
      sizes: Array.from(new Set(rows.map((row) => row.item.size.label))).sort()
    }),
    [rows]
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (filters.client && row.order.client.name !== filters.client) return false;
        if (filters.product && row.item.product.name !== filters.product) return false;
        if (filters.size && row.item.size.label !== filters.size) return false;
        if (filters.stage !== "all" && row.stage !== filters.stage) return false;
        return true;
      }),
    [filters, rows]
  );

  const summary = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of filteredRows) {
      totals.set(row.item.product.name, (totals.get(row.item.product.name) ?? 0) + row.item.quantity_requested);
    }
    return Array.from(totals.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredRows]);

  function replaceOrder(updated: OrderDetails, message: string) {
    setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
    setSuccess(message);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
            Controle operacional por item da OS
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

      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
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
            <FilterSelect
              label="Tamanho"
              value={filters.size}
              options={options.sizes}
              onChange={(size) => setFilters((current) => ({ ...current, size }))}
            />
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-ink">Etapa</span>
              <select
                className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
                value={filters.stage}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, stage: event.target.value as StageFilter }))
                }
              >
                {(Object.entries(stageLabels) as Array<[StageFilter, string]>).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {summary.length === 0 ? (
              <Badge tone="warning">Nenhum item no filtro</Badge>
            ) : (
              summary.map(([product, quantity]) => (
                <Badge key={product} tone="accent">
                  {quantity} {product.toLowerCase()}
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-lg border border-line bg-white" />
          ))}
        </div>
      ) : filteredRows.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm font-semibold text-muted">Nenhum item encontrado para os filtros atuais.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRows.map((row) => (
            <ProductionItemCard
              key={`${row.order.id}-${row.item.id}`}
              order={row.order}
              item={row.item}
              itemNumber={row.itemNumber}
              onCut={() => setCutTarget({ order: row.order, item: row.item })}
              onPrint={() => setPrintTarget({ order: row.order, item: row.item })}
              onSew={() => setSewTarget({ order: row.order, item: row.item })}
              onOutsource={() => router.push("/outsourcing")}
            />
          ))}
        </div>
      )}

      <ProductionCutModal
        open={Boolean(cutTarget)}
        order={cutTarget?.order ?? null}
        item={cutTarget?.item ?? null}
        onClose={() => setCutTarget(null)}
        onUpdated={(order) => replaceOrder(order, `Corte registrado na OS #${order.id}.`)}
      />
      <PrintActionModal
        open={Boolean(printTarget)}
        order={printTarget?.order ?? null}
        item={printTarget?.item ?? null}
        onClose={() => setPrintTarget(null)}
        onUpdated={(order) => replaceOrder(order, `Serigrafia registrada na OS #${order.id}.`)}
      />
      <ProductionSewModal
        open={Boolean(sewTarget)}
        order={sewTarget?.order ?? null}
        item={sewTarget?.item ?? null}
        onClose={() => setSewTarget(null)}
        onUpdated={(order) => replaceOrder(order, `Confeccao registrada na OS #${order.id}.`)}
      />
    </div>
  );
}

function ProductionItemCard({
  order,
  item,
  itemNumber,
  onCut,
  onPrint,
  onSew,
  onOutsource
}: {
  order: OrderDetails;
  item: OrderItem;
  itemNumber: number;
  onCut: () => void;
  onPrint: () => void;
  onSew: () => void;
  onOutsource: () => void;
}) {
  const stages = flowStageOptions(item);
  return (
    <div className="grid gap-4 rounded-lg border border-line bg-white p-4 shadow-insetline xl:grid-cols-[1.1fr_1.35fr_auto] xl:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-black text-ink">OS #{order.id}</span>
          <Badge tone="accent">Item {itemNumber}</Badge>
        </div>
        <p className="mt-1 text-sm font-semibold text-muted">{order.client.name}</p>
        <p className="mt-3 text-sm text-muted">
          <span className="font-bold text-ink">{item.product.name}</span> / tamanho {item.size.label} /{" "}
          {item.color || "sem cor"}
        </p>
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-accent-dark">
          {itemFlowLabel(item)}
        </p>
      </div>

      <div className="grid gap-3 rounded-md border border-line bg-[#FCFAF6] p-3 md:grid-cols-5">
        <Metric label="Solicitado" value={item.quantity_requested} />
        <Metric label="Cortado" value={item.quantity_cut} />
        {itemNeedsStage(item, "print") ? <Metric label="Estampado" value={item.quantity_printed} /> : null}
        {itemNeedsStage(item, "sew") ? <Metric label="Confeccionado" value={item.quantity_sewn} /> : null}
        <Metric label="Faltam cortar" value={missingCut(item)} />
      </div>

      <div className="flex flex-wrap gap-2 xl:justify-end">
        {stages.includes("cut") ? (
          <Button type="button" disabled={itemStageDone(item, "cut")} onClick={onCut}>
            <Scissors size={16} />
            Registrar corte
          </Button>
        ) : null}
        {stages.includes("print") ? (
          <Button type="button" disabled={!itemStageDone(item, "cut") || itemStageDone(item, "print")} onClick={onPrint}>
            <Stamp size={16} />
            Registrar serigrafia
          </Button>
        ) : null}
        {stages.includes("sew") ? (
          <Button type="button" disabled={!itemStageDone(item, "cut") || itemStageDone(item, "sew")} onClick={onSew}>
            <Shirt size={16} />
            Registrar confeccao
          </Button>
        ) : null}
        {stages.includes("outsourcing") ? (
          <Button
            type="button"
            variant="secondary"
            disabled={
              (itemNeedsStage(item, "cut") && !itemStageDone(item, "cut")) ||
              (itemNeedsStage(item, "print") && !itemStageDone(item, "print"))
            }
            onClick={onOutsource}
          >
            <ArrowRight size={16} />
            Terceirizar
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-md bg-white p-3 shadow-insetline">
      <p className="truncate text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className="mt-1 text-xl font-black text-ink">{value}</p>
    </div>
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
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <select
        className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
