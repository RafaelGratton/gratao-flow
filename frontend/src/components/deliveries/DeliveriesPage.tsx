"use client";

import { CheckCircle2, Clock3, PackageCheck, RefreshCw, Truck, Undo2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { DeliveryStatus } from "@/components/orders/types";
import type { DeliveryItem, DeliveryList } from "@/components/deliveries/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

type Filters = {
  client: string;
  product: string;
  size: string;
  status: DeliveryStatus | "";
};

const statusLabels: Record<DeliveryStatus, string> = {
  pending: "Pendente",
  ready: "Pronto para entrega",
  partially_delivered: "Entrega parcial",
  delivered: "Entregue"
};

const statusTone: Record<DeliveryStatus, "neutral" | "accent" | "success" | "warning"> = {
  pending: "neutral",
  ready: "accent",
  partially_delivered: "warning",
  delivered: "success"
};

const statusOptions: Array<{ value: DeliveryStatus | ""; label: string }> = [
  { value: "", label: "Todos" },
  { value: "ready", label: "Prontos" },
  { value: "partially_delivered", label: "Parciais" },
  { value: "delivered", label: "Entregues" },
  { value: "pending", label: "Pendentes" }
];

export function DeliveriesPage() {
  const [data, setData] = useState<DeliveryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selected, setSelected] = useState<DeliveryItem | null>(null);
  const [filters, setFilters] = useState<Filters>({
    client: "",
    product: "",
    size: "",
    status: ""
  });

  const loadDeliveries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.get<DeliveryList>("/deliveries"));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel carregar entregas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDeliveries();
  }, [loadDeliveries]);

  const items = data?.items ?? [];
  const options = useMemo(
    () => ({
      clients: Array.from(new Set(items.map((item) => item.client.name))).sort(),
      products: Array.from(new Set(items.map((item) => item.product.name))).sort(),
      sizes: Array.from(new Set(items.map((item) => item.size.label))).sort()
    }),
    [items]
  );

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (filters.client && item.client.name !== filters.client) return false;
        if (filters.product && item.product.name !== filters.product) return false;
        if (filters.size && item.size.label !== filters.size) return false;
        if (filters.status && item.delivery_status !== filters.status) return false;
        return true;
      }),
    [filters, items]
  );

  function replaceItem(updated: DeliveryItem) {
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) =>
          item.order_item_id === updated.order_item_id ? updated : item
        )
      };
    });
    setSelected(null);
    setSuccess(`Entrega registrada na OS #${updated.order_id}.`);
    void loadDeliveries();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
            Saida operacional por item da OS
          </p>
          <h1 className="mt-1 text-3xl font-black text-ink">Entregas</h1>
        </div>
        <Button type="button" variant="secondary" onClick={() => void loadDeliveries()} disabled={loading}>
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

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Prontos para entrega" value={data?.summary.ready ?? 0} icon={PackageCheck} />
        <SummaryCard label="Entregas parciais" value={data?.summary.partially_delivered ?? 0} icon={Truck} />
        <SummaryCard label="Entregues hoje" value={data?.summary.delivered_today ?? 0} icon={CheckCircle2} />
        <SummaryCard label="Pendentes" value={data?.summary.pending ?? 0} icon={Clock3} />
      </div>

      <Card>
        <CardContent>
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
              <span className="text-sm font-semibold text-ink">Status</span>
              <select
                className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value as DeliveryStatus | ""
                  }))
                }
              >
                {statusOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="bg-white/70">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
                Itens e saldo de entrega
              </p>
              <h2 className="mt-1 text-xl font-black text-ink">Fila de entregas</h2>
            </div>
            <Badge tone="neutral">{filteredItems.length} itens</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-5 text-sm font-semibold text-muted">
              Nenhum item encontrado para os filtros atuais.
            </div>
          ) : (
            <div className="divide-y divide-line/70">
              {filteredItems.map((item) => (
                <DeliveryRow
                  key={item.order_item_id}
                  item={item}
                  onRegister={() => setSelected(item)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DeliveryModal
        item={selected}
        onClose={() => setSelected(null)}
        onSaved={replaceItem}
        onError={setError}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: number;
  icon: typeof PackageCheck;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className="grid h-11 w-11 place-items-center rounded-md bg-accent-soft text-accent-dark">
          <Icon size={20} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
          <p className="mt-1 text-2xl font-black text-ink">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DeliveryRow({ item, onRegister }: { item: DeliveryItem; onRegister: () => void }) {
  return (
    <div className="grid gap-4 p-5 transition hover:bg-accent-soft/25 xl:grid-cols-[1.25fr_1.2fr_1fr_auto] xl:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-black text-ink">OS #{item.order_id}</span>
          <Badge tone={statusTone[item.delivery_status]}>{statusLabels[item.delivery_status]}</Badge>
        </div>
        <p className="mt-1 text-sm font-semibold text-muted">{item.client.name}</p>
        <p className="mt-3 text-sm text-muted">
          <span className="font-bold text-ink">{item.product.name}</span> / tamanho {item.size.label} /{" "}
          {item.color || "sem cor"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-md border border-line bg-[#FCFAF6] p-3">
        <Metric label="Solicitado" value={item.quantity_requested} />
        <Metric label="Entregue" value={item.quantity_delivered} />
        <Metric label="Faltam" value={item.quantity_remaining} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-ink">Historico</p>
        {item.history.length === 0 ? (
          <p className="text-xs font-semibold text-muted">Sem entregas registradas</p>
        ) : (
          <div className="space-y-1">
            {item.history.slice(-2).map((entry) => (
              <p key={entry.id} className="text-xs text-muted">
                {entry.quantity} pecas - {formatDateTime(entry.delivered_at)}
              </p>
            ))}
          </div>
        )}
      </div>

      <Button
        type="button"
        disabled={item.delivery_status === "pending" || item.delivery_status === "delivered"}
        onClick={onRegister}
      >
        <Truck size={16} />
        Registrar entrega
      </Button>
    </div>
  );
}

function DeliveryModal({
  item,
  onClose,
  onSaved,
  onError
}: {
  item: DeliveryItem | null;
  onClose: () => void;
  onSaved: (item: DeliveryItem) => void;
  onError: (message: string | null) => void;
}) {
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setQuantity("");
      setNotes("");
    }
  }, [item]);

  if (!item) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item) return;
    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      onError("Informe uma quantidade entregue valida.");
      return;
    }
    if (parsedQuantity > item.quantity_remaining) {
      onError(`Quantidade entregue excede o solicitado. Faltam entregar ${item.quantity_remaining}.`);
      return;
    }

    setSaving(true);
    onError(null);
    try {
      const updated = await api.post<DeliveryItem>(`/deliveries/${item.order_item_id}/register`, {
        quantity: parsedQuantity,
        notes: notes || null
      });
      onSaved(updated);
    } catch (requestError) {
      onError(requestError instanceof Error ? requestError.message : "Nao foi possivel registrar a entrega.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-xl rounded-lg border border-line bg-white shadow-soft">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Registrar entrega</p>
            <h2 className="mt-1 text-xl font-black text-ink">
              OS #{item.order_id} - {item.product.name}
            </h2>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            <Undo2 size={16} />
            Voltar
          </Button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <Metric label="Solicitado" value={item.quantity_requested} />
            <Metric label="Entregue" value={item.quantity_delivered} />
            <Metric label="Faltam" value={item.quantity_remaining} />
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Quantidade entregue agora</span>
            <input
              className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
              type="number"
              min="1"
              max={item.quantity_remaining}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
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

          {item.history.length > 0 ? (
            <div className="rounded-md border border-line bg-[#FCFAF6] p-3">
              <p className="text-sm font-black text-ink">Historico de entrega</p>
              <div className="mt-3 space-y-2">
                {item.history.map((entry) => (
                  <div key={entry.id} className="flex flex-col gap-1 text-xs text-muted md:flex-row md:items-center md:justify-between">
                    <span>
                      {entry.quantity} pecas por {entry.responsible}
                    </span>
                    <span>{formatDateTime(entry.delivered_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={saving}>
            Registrar entrega
          </Button>
        </div>
      </form>
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
