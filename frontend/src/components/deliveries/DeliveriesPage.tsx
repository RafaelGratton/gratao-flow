"use client";

import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock3,
  History,
  PackageCheck,
  Printer,
  RefreshCw,
  Search,
  Truck,
  Undo2
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type {
  DeliveryItem,
  DeliveryList,
  DeliveryOperationalStatus,
  DeliveryQueueStatus
} from "@/components/deliveries/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

type Filters = {
  client: string;
  product: string;
  size: string;
  search: string;
  onlyBlocked: boolean;
};

type DeliveryOrderGroup = {
  orderId: number;
  client: DeliveryItem["client"];
  items: DeliveryItem[];
  productionPaused: boolean;
  requested: number;
  ready: number;
  available: number;
  delivered: number;
  remaining: number;
  operationalStatus: DeliveryOperationalStatus;
  blocked: boolean;
  blockedItems: number;
  waitingDays: number;
};

const WITHDRAWAL_PROOF_MESSAGE =
  "Informe quem retirou e um documento ou contato para registrar a entrega.";

const queueTabs: Array<{ value: DeliveryQueueStatus; label: string }> = [
  { value: "ready_for_pickup", label: "Prontos para retirada" },
  { value: "partial", label: "Parciais" },
  { value: "pending", label: "Pendentes" },
  { value: "delivered", label: "Entregues" }
];

const operationalLabels: Record<DeliveryOperationalStatus, string> = {
  waiting_production: "Aguardando producao",
  ready_partial_waiting_pickup: "Pronto parcial - aguardando retirada",
  ready_total_waiting_pickup: "Pronto total - aguardando retirada",
  delivered_partial_waiting_pickup: "Entregue parcial - saldo aguardando retirada",
  delivered_partial_waiting_production: "Entregue parcial - aguardando producao",
  delivered_total: "Entregue total"
};

const operationalTone: Record<DeliveryOperationalStatus, "neutral" | "accent" | "success" | "warning"> = {
  waiting_production: "neutral",
  ready_partial_waiting_pickup: "warning",
  ready_total_waiting_pickup: "accent",
  delivered_partial_waiting_pickup: "warning",
  delivered_partial_waiting_production: "warning",
  delivered_total: "success"
};

const operationalRank: Record<DeliveryOperationalStatus, number> = {
  delivered_partial_waiting_pickup: 0,
  ready_partial_waiting_pickup: 1,
  ready_total_waiting_pickup: 2,
  delivered_partial_waiting_production: 3,
  waiting_production: 4,
  delivered_total: 5
};

export function DeliveriesPage() {
  const [data, setData] = useState<DeliveryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selected, setSelected] = useState<DeliveryItem | null>(null);
  const [proof, setProof] = useState<{ item: DeliveryItem; entry: DeliveryItem["history"][number] } | null>(null);
  const [activeTab, setActiveTab] = useState<DeliveryQueueStatus>("ready_for_pickup");
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(() => new Set());
  const [filters, setFilters] = useState<Filters>({
    client: "",
    product: "",
    size: "",
    search: "",
    onlyBlocked: false
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

  const clientWaitingCount = useMemo(() => {
    const counts = new Map<number, number>();
    items.forEach((item) => {
      if (item.quantity_available_to_deliver > 0) {
        counts.set(item.client.id, (counts.get(item.client.id) ?? 0) + 1);
      }
    });
    return counts;
  }, [items]);

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (item.queue_status !== activeTab) return false;
        if (filters.client && item.client.name !== filters.client) return false;
        if (filters.product && item.product.name !== filters.product) return false;
        if (filters.size && item.size.label !== filters.size) return false;
        if (filters.onlyBlocked && !isBlocked(item, clientWaitingCount.get(item.client.id) ?? 0)) {
          return false;
        }
        if (filters.search && !matchesSearch(item, filters.search)) return false;
        return true;
      }),
    [activeTab, clientWaitingCount, filters, items]
  );

  const deliveryGroups = useMemo<DeliveryOrderGroup[]>(() => {
    const grouped = new Map<number, DeliveryItem[]>();

    filteredItems.forEach((item) => {
      const groupItems = grouped.get(item.order_id) ?? [];
      groupItems.push(item);
      grouped.set(item.order_id, groupItems);
    });

    return Array.from(grouped.values())
      .map((groupItems) => {
        const sortedItems = [...groupItems].sort((a, b) => {
          if (b.quantity_available_to_deliver !== a.quantity_available_to_deliver) {
            return b.quantity_available_to_deliver - a.quantity_available_to_deliver;
          }
          return a.order_item_id - b.order_item_id;
        });
        const blockedItems = sortedItems.filter((item) =>
          isBlocked(item, clientWaitingCount.get(item.client.id) ?? 0)
        ).length;
        const operationalStatus = sortedItems.reduce(
          (current, item) =>
            operationalRank[item.operational_status] < operationalRank[current]
              ? item.operational_status
              : current,
          sortedItems[0].operational_status
        );

        return {
          orderId: sortedItems[0].order_id,
          client: sortedItems[0].client,
          items: sortedItems,
          productionPaused: sortedItems.some((item) => item.production_paused),
          requested: sortedItems.reduce((total, item) => total + item.quantity_requested, 0),
          ready: sortedItems.reduce((total, item) => total + item.quantity_ready_total, 0),
          available: sortedItems.reduce((total, item) => total + item.quantity_available_to_deliver, 0),
          delivered: sortedItems.reduce((total, item) => total + item.quantity_delivered, 0),
          remaining: sortedItems.reduce((total, item) => total + item.quantity_remaining, 0),
          operationalStatus,
          blocked: blockedItems > 0,
          blockedItems,
          waitingDays: Math.max(
            ...sortedItems.map((item) =>
              Math.max(item.ready_waiting_days ?? 0, item.partially_delivered_days ?? 0)
            )
          )
        };
      })
      .sort((a, b) => {
        if (a.blocked !== b.blocked) return a.blocked ? -1 : 1;
        if (b.available !== a.available) return b.available - a.available;
        if (b.waitingDays !== a.waitingDays) return b.waitingDays - a.waitingDays;
        return a.orderId - b.orderId;
      });
  }, [clientWaitingCount, filteredItems]);

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
        <SummaryCard label="Prontos para retirada" value={data?.summary.ready ?? 0} icon={PackageCheck} />
        <SummaryCard label="Parciais" value={data?.summary.partial ?? data?.summary.partially_delivered ?? 0} icon={Truck} />
        <SummaryCard label="Entregues hoje" value={data?.summary.delivered_today ?? 0} icon={CheckCircle2} />
        <SummaryCard label="Pendentes" value={data?.summary.pending ?? 0} icon={Clock3} />
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto] md:items-end">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-ink">Busca livre</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                <input
                  className="h-12 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  placeholder="OS, cliente, produto, cor, retirante..."
                />
              </div>
            </label>
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
            <label className="flex h-12 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-ink shadow-insetline">
              <input
                type="checkbox"
                checked={filters.onlyBlocked}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, onlyBlocked: event.target.checked }))
                }
              />
              Alertas
            </label>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="bg-white/70">
          <div className="space-y-4">
            <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
                  Fila logistica de saida
                </p>
                <h2 className="mt-1 text-xl font-black text-ink">Retirada por item</h2>
              </div>
              <Badge tone="neutral">{filteredItems.length} itens</Badge>
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              {queueTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  className={`rounded-md border px-3 py-2 text-sm font-black transition ${
                    activeTab === tab.value
                      ? "border-accent bg-accent-soft text-accent-dark"
                      : "border-line bg-white text-muted hover:text-ink"
                  }`}
                  onClick={() => setActiveTab(tab.value)}
                >
                  {tab.label}
                  <span className="ml-2 text-xs font-semibold">
                    {items.filter((item) => item.queue_status === tab.value).length}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-5 text-sm font-semibold text-muted">
              Nenhum item encontrado para esta fila e filtros.
            </div>
          ) : (
            <div className="space-y-3 p-5">
              {deliveryGroups.map((group) => (
                <DeliveryOrderCard
                  key={group.orderId}
                  group={group}
                  expanded={expandedOrders.has(group.orderId)}
                  onToggle={() => toggleOrder(group.orderId)}
                  clientWaitingCount={clientWaitingCount}
                  onRegister={(item) => setSelected(item)}
                  onProof={(item, entry) => setProof({ item, entry })}
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
      <DeliveryProofModal proof={proof} onClose={() => setProof(null)} />
    </div>
  );
}

function DeliveryOrderCard({
  group,
  expanded,
  onToggle,
  clientWaitingCount,
  onRegister,
  onProof
}: {
  group: DeliveryOrderGroup;
  expanded: boolean;
  onToggle: () => void;
  clientWaitingCount: Map<number, number>;
  onRegister: (item: DeliveryItem) => void;
  onProof: (item: DeliveryItem, entry: DeliveryItem["history"][number]) => void;
}) {
  const itemLabel = group.items.length === 1 ? "item nesta aba" : "itens nesta aba";

  return (
    <div
      className={`overflow-hidden rounded-lg border border-line bg-white shadow-insetline ${
        group.blocked ? "border-warning/25 bg-warning/5" : ""
      }`}
    >
      <div className="grid gap-4 p-5 xl:grid-cols-[1.15fr_1.35fr_1fr_auto] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-black text-ink">OS #{group.orderId}</span>
            <Badge tone="accent">
              {group.items.length} {itemLabel}
            </Badge>
            <Badge tone={operationalTone[group.operationalStatus]}>
              {operationalLabels[group.operationalStatus]}
            </Badge>
            {group.productionPaused ? <Badge tone="warning">Producao pausada</Badge> : null}
            {group.blocked ? (
              <Badge tone="warning">
                <AlertTriangle size={13} />
                {group.blockedItems} {group.blockedItems === 1 ? "alerta" : "alertas"}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-semibold text-muted">{group.client.name}</p>
          {group.waitingDays > 0 ? (
            <p className="mt-2 text-xs font-bold text-warning">Esperando retirada ha {formatAge(group.waitingDays)}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-md border border-line bg-[#FCFAF6] p-3 md:grid-cols-5">
          <Metric label="Solicitado" value={group.requested} />
          <Metric label="Pronto" value={group.ready} />
          <Metric label="Disponivel" value={group.available} />
          <Metric label="Entregue" value={group.delivered} />
          <Metric label="Falta entregar" value={group.remaining} />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Resumo</p>
          <p className="text-sm font-semibold text-ink">
            {group.available} disponivel{group.available === 1 ? "" : "s"} para entrega
          </p>
          <p className="text-xs font-semibold text-muted">{group.delivered} ja entregue{group.delivered === 1 ? "" : "s"}</p>
        </div>

        <Button type="button" variant="secondary" onClick={onToggle} aria-expanded={expanded}>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          Ver itens
        </Button>
      </div>

      {expanded ? (
        <div className="border-t border-line/70 bg-[#FCFAF6]/70">
          <div className="divide-y divide-line/70">
            {group.items.map((item) => (
              <DeliveryRow
                key={item.order_item_id}
                item={item}
                clientWaitingItems={clientWaitingCount.get(item.client.id) ?? 0}
                onRegister={() => onRegister(item)}
                onProof={(entry) => onProof(item, entry)}
              />
            ))}
          </div>
        </div>
      ) : null}
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

function DeliveryRow({
  item,
  clientWaitingItems,
  onRegister,
  onProof
}: {
  item: DeliveryItem;
  clientWaitingItems: number;
  onRegister: () => void;
  onProof: (entry: DeliveryItem["history"][number]) => void;
}) {
  const [showFullHistory, setShowFullHistory] = useState(false);
  const visibleHistory = showFullHistory ? item.history : item.history.slice(-2);
  const canRegister =
    item.quantity_available_to_deliver > 0 &&
    item.queue_status !== "delivered" &&
    !item.production_paused;
  const blocked = isBlocked(item, clientWaitingItems);

  return (
    <div className={`grid gap-4 p-5 transition hover:bg-accent-soft/25 xl:grid-cols-[1.25fr_1.3fr_1.1fr_auto] xl:items-center ${
      blocked ? "bg-warning/5" : ""
    }`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-black text-ink">OS #{item.order_id}</span>
          <Badge tone={operationalTone[item.operational_status]}>
            {operationalLabels[item.operational_status]}
          </Badge>
          {blocked ? (
            <Badge tone="warning">
              <AlertTriangle size={13} />
              Gargalo
            </Badge>
          ) : null}
          {item.production_paused ? <Badge tone="warning">Producao pausada</Badge> : null}
        </div>
        <p className="mt-1 text-sm font-semibold text-muted">{item.client.name}</p>
        <p className="mt-3 text-sm text-muted">
          <span className="font-bold text-ink">{item.product.name}</span> / tamanho {item.size.label} /{" "}
          {item.color || "sem cor"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-muted">
          <span>Pronto desde: {item.ready_since ? formatDateTime(item.ready_since) : "sem saldo pronto"}</span>
          <span>Pronto ha: {formatAge(item.ready_waiting_days)}</span>
          <span>Ultima entrega: {item.last_delivery_at ? formatDateTime(item.last_delivery_at) : "nenhuma"}</span>
        </div>
        {item.last_picked_up_by ? (
          <p className="mt-2 text-xs font-semibold text-ink">
            Ultima retirada: {item.last_picked_up_by}
            {item.last_pickup_document ? ` / ${item.last_pickup_document}` : ""}
          </p>
        ) : null}
        {clientWaitingItems >= 3 ? (
          <p className="mt-2 text-xs font-bold text-warning">
            Cliente com {clientWaitingItems} itens aguardando retirada.
          </p>
        ) : null}
        {item.important_notes.length > 0 ? (
          <p className="mt-2 text-xs text-muted">Obs.: {item.important_notes.join(" / ")}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-md border border-line bg-[#FCFAF6] p-3 md:grid-cols-5">
        <Metric label="Solicitado" value={item.quantity_requested} />
        <Metric label="Pronto" value={item.quantity_ready_total} />
        <Metric label="Disponivel" value={item.quantity_available_to_deliver} />
        <Metric label="Entregue" value={item.quantity_delivered} />
        <Metric label="Falta entregar" value={item.quantity_remaining} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">Historico</p>
          {item.has_multiple_deliveries ? <Badge tone="accent">multiplas</Badge> : null}
        </div>
        {item.history.length === 0 ? (
          <p className="text-xs font-semibold text-muted">Sem entregas registradas</p>
        ) : (
          <div className="space-y-2">
            {visibleHistory.map((entry) => (
              <div key={entry.id} className="rounded-md border border-line bg-white p-2 text-xs text-muted">
                <p className="font-semibold text-ink">
                  {entry.quantity} pecas - {formatDateTime(entry.delivered_at)}
                </p>
                <p>Retirado por: {entry.picked_up_by || "sem retirante"}</p>
                <p>Documento/contato: {entry.pickup_document || "sem comprovante"}</p>
                {entry.delivery_notes ? <p>Retirada: {entry.delivery_notes}</p> : null}
                {entry.notes ? <p>Interno: {entry.notes}</p> : null}
                <p>Usuario: {entry.responsible}</p>
                <button
                  type="button"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-accent-dark"
                  onClick={() => onProof(entry)}
                >
                  <Printer size={13} />
                  Ver comprovante
                </button>
              </div>
            ))}
            {item.history.length > 2 ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-bold text-accent-dark"
                onClick={() => setShowFullHistory((current) => !current)}
              >
                <History size={13} />
                {showFullHistory ? "Ver resumo" : "Ver historico completo"}
              </button>
            ) : null}
          </div>
        )}
        {item.has_weak_delivery_proof ? (
          <Badge tone="danger">historico antigo sem comprovante forte</Badge>
        ) : null}
      </div>

      <Button type="button" disabled={!canRegister} onClick={onRegister}>
        <Truck size={16} />
        {item.production_paused ? "Producao pausada" : "Registrar entrega"}
      </Button>
    </div>
  );
}

function DeliveryProofModal({
  proof,
  onClose
}: {
  proof: { item: DeliveryItem; entry: DeliveryItem["history"][number] } | null;
  onClose: () => void;
}) {
  if (!proof) return null;
  const { item, entry } = proof;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <div className="w-full max-w-xl rounded-lg border border-line bg-white shadow-soft">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 print:hidden">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Comprovante de entrega</p>
            <h2 className="mt-1 text-xl font-black text-ink">OS #{item.order_id}</h2>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => window.print()}>
              <Printer size={16} />
              Imprimir
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
        <div className="space-y-4 p-6 text-sm text-ink">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Gratao Uniformes</p>
            <h3 className="mt-1 text-2xl font-black">Comprovante de entrega</h3>
          </div>
          <div className="grid gap-3 rounded-md border border-line bg-[#FCFAF6] p-4 md:grid-cols-2">
            <ProofLine label="OS" value={`#${item.order_id}`} />
            <ProofLine label="Cliente" value={item.client.name} />
            <ProofLine label="Produto" value={item.product.name} />
            <ProofLine label="Cor" value={item.color || "sem cor"} />
            <ProofLine label="Tamanho" value={item.size.label} />
            <ProofLine label="Quantidade entregue" value={entry.quantity} />
            <ProofLine label="Quem retirou" value={entry.picked_up_by || "nao informado"} />
            <ProofLine label="Documento/contato" value={entry.pickup_document || "nao informado"} />
            <ProofLine label="Data/hora" value={formatDateTime(entry.delivered_at)} />
            <ProofLine label="Usuario" value={entry.user_name_snapshot || entry.responsible} />
          </div>
          {entry.delivery_notes ? (
            <div className="rounded-md border border-line p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Observacao de retirada</p>
              <p className="mt-2 font-semibold">{entry.delivery_notes}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProofLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className="mt-1 font-black text-ink">{value}</p>
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
  const [pickedUpBy, setPickedUpBy] = useState("");
  const [pickupDocument, setPickupDocument] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setQuantity("");
      setPickedUpBy("");
      setPickupDocument("");
      setDeliveryNotes("");
      setNotes("");
    }
  }, [item]);

  if (!item) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item) return;
    if (item.production_paused) {
      onError("A producao desta OS esta pausada. Retome a OS antes de registrar entrega.");
      return;
    }
    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      onError("Informe uma quantidade entregue valida.");
      return;
    }
    if (parsedQuantity > item.quantity_available_to_deliver) {
      onError(`Quantidade entregue excede o disponivel agora. Maximo: ${item.quantity_available_to_deliver}.`);
      return;
    }
    if (!pickedUpBy.trim() || !pickupDocument.trim()) {
      onError(WITHDRAWAL_PROOF_MESSAGE);
      return;
    }

    setSaving(true);
    onError(null);
    try {
      const updated = await api.post<DeliveryItem>(`/deliveries/${item.order_item_id}/register`, {
        quantity: parsedQuantity,
        picked_up_by: pickedUpBy.trim(),
        pickup_document: pickupDocument.trim(),
        delivery_notes: deliveryNotes.trim() || null,
        notes: notes.trim() || null
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
      <form onSubmit={handleSubmit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-line bg-white shadow-soft">
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
          {item.production_paused ? (
            <div className="rounded-md border border-warning/25 bg-warning/10 p-3 text-sm font-semibold text-warning">
              Producao pausada. O backend bloqueia novas entregas enquanto a OS permanecer pausada.
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-5">
            <Metric label="Solicitado" value={item.quantity_requested} />
            <Metric label="Pronto" value={item.quantity_ready_total} />
            <Metric label="Disponivel" value={item.quantity_available_to_deliver} />
            <Metric label="Entregue" value={item.quantity_delivered} />
            <Metric label="Falta" value={item.quantity_remaining} />
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Quantidade entregue agora</span>
            <input
              className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
              type="number"
              min="1"
              max={item.quantity_available_to_deliver}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-ink">Quem retirou</span>
              <input
                className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
                type="text"
                value={pickedUpBy}
                onChange={(event) => setPickedUpBy(event.target.value)}
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-ink">Documento ou contato</span>
              <input
                className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
                type="text"
                value={pickupDocument}
                onChange={(event) => setPickupDocument(event.target.value)}
                required
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Observacao da retirada</span>
            <textarea
              className="min-h-24 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink shadow-insetline transition focus:focus-ring"
              value={deliveryNotes}
              onChange={(event) => setDeliveryNotes(event.target.value)}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Observacao interna</span>
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
                {item.history.map((entry, index) => (
                  <div key={entry.id} className="rounded-md border border-line bg-white p-3 text-xs text-muted">
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <span className="font-semibold text-ink">
                        #{index + 1} - {entry.quantity} pecas por {entry.responsible}
                      </span>
                      <span>{formatDateTime(entry.delivered_at)}</span>
                    </div>
                    <p className="mt-2">Retirado por: {entry.picked_up_by || "sem retirante"}</p>
                    <p>Documento/contato: {entry.pickup_document || "sem comprovante"}</p>
                    {entry.delivery_notes ? <p>Retirada: {entry.delivery_notes}</p> : null}
                    {entry.notes ? <p>Observacao interna: {entry.notes}</p> : null}
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
          <Button type="submit" isLoading={saving} disabled={item.production_paused}>
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

function matchesSearch(item: DeliveryItem, query: string): boolean {
  const needle = normalize(query);
  const values = [
    String(item.order_id),
    item.client.name,
    item.product.name,
    item.color,
    item.size.label,
    operationalLabels[item.operational_status],
    ...item.important_notes,
    ...item.history.flatMap((entry) => [
      entry.picked_up_by || "",
      entry.pickup_document || "",
      entry.delivery_notes || "",
      entry.notes || "",
      entry.responsible
    ])
  ];
  return normalize(values.join(" ")).includes(needle);
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatAge(days: number | null): string {
  if (days === null) return "-";
  if (days === 0) return "hoje";
  return `${days} dia${days === 1 ? "" : "s"}`;
}

function isBlocked(item: DeliveryItem, clientWaitingItems: number): boolean {
  return (
    item.bottleneck_flags.length > 0 ||
    item.has_weak_delivery_proof ||
    clientWaitingItems >= 3 ||
    (item.ready_waiting_days ?? 0) >= 3 ||
    (item.partially_delivered_days ?? 0) >= 3
  );
}
