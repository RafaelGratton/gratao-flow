"use client";

import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { SelectHTMLAttributes } from "react";
import type { Client } from "@/components/clients/types";
import type { CatalogItem, OperationalPriority, OrderDetails, SewingMode } from "@/components/orders/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";

type OrderEditModalProps = {
  order: OrderDetails;
  open: boolean;
  onClose: () => void;
  onUpdated: (order: OrderDetails) => void;
};

type EditItem = {
  id: number | null;
  product_id: string;
  size_id: string;
  color: string;
  quantity_requested: number;
  operational_priority: OperationalPriority;
  sewing_mode: SewingMode;
  service_ids: number[];
  notes: string;
};

type CatalogData = {
  clients: Client[];
  products: CatalogItem[];
  sizes: CatalogItem[];
  services: CatalogItem[];
};

const emptyCatalogs: CatalogData = {
  clients: [],
  products: [],
  sizes: [],
  services: []
};

function emptyItem(): EditItem {
  return {
    id: null,
    product_id: "",
    size_id: "",
    color: "",
    quantity_requested: 1,
    operational_priority: "normal",
    sewing_mode: "internal",
    service_ids: [],
    notes: ""
  };
}

export function OrderEditModal({ order, open, onClose, onUpdated }: OrderEditModalProps) {
  const locked = orderHasMovements(order);
  const [catalogs, setCatalogs] = useState<CatalogData>(emptyCatalogs);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState(String(order.client.id));
  const [notes, setNotes] = useState(order.notes ?? "");
  const [allowPrintingException, setAllowPrintingException] = useState(
    order.allow_printing_exception
  );
  const [items, setItems] = useState<EditItem[]>(() => orderToItems(order));

  useEffect(() => {
    if (!open) return;
    setClientId(String(order.client.id));
    setNotes(order.notes ?? "");
    setAllowPrintingException(order.allow_printing_exception);
    setItems(orderToItems(order));
    setError(null);
  }, [open, order]);

  useEffect(() => {
    if (!open) return;
    let active = true;

    async function loadCatalogs() {
      setLoading(true);
      setError(null);
      try {
        const [clients, products, sizes, services] = await Promise.all([
          api.get<Client[]>("/clients"),
          api.get<CatalogItem[]>("/products"),
          api.get<CatalogItem[]>("/sizes"),
          api.get<CatalogItem[]>("/services")
        ]);

        if (active) {
          setCatalogs({
            clients,
            products,
            sizes,
            services: services.filter((service) => service.is_active !== false)
          });
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Nao foi possivel carregar os dados para edicao."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadCatalogs();

    return () => {
      active = false;
    };
  }, [open]);

  const estimatedTotal = useMemo(() => {
    return items.reduce((orderTotal, item) => {
      const quantity = Number(item.quantity_requested || 0);
      const itemTotal = catalogs.services
        .filter((service) => item.service_ids.includes(service.id))
        .reduce(
          (total, service) => total + Number(service.price_per_unit ?? 0) * quantity,
          0
        );
      return orderTotal + itemTotal;
    }, 0);
  }, [catalogs.services, items]);

  if (!open) return null;

  function updateItem(index: number, patch: Partial<EditItem>) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    );
  }

  function toggleService(index: number, serviceId: number) {
    const item = items[index];
    if (!item) return;
    const service = catalogs.services.find((candidate) => candidate.id === serviceId);
    if (item.sewing_mode === "outsourced" && service?.type === "confeccao") {
      return;
    }

    const selected = item.service_ids.includes(serviceId);
    updateItem(index, {
      service_ids: selected
        ? item.service_ids.filter((id) => id !== serviceId)
        : [...item.service_ids, serviceId]
    });
  }

  function setProductionMode(index: number, mode: SewingMode) {
    const item = items[index];
    if (!item) return;
    updateItem(index, {
      sewing_mode: mode,
      service_ids:
        mode === "outsourced"
          ? item.service_ids.filter((serviceId) => !isSewingService(serviceId))
          : item.service_ids
    });
  }

  function isSewingService(serviceId: number) {
    return catalogs.services.some(
      (service) => service.id === serviceId && service.type === "confeccao"
    );
  }

  async function saveOrder() {
    setSaving(true);
    setError(null);

    try {
      const payloadItems = items.map((item) => {
        const serviceIds = item.service_ids.filter(
          (serviceId) => !(item.sewing_mode === "outsourced" && isSewingService(serviceId))
        );
        return {
          id: item.id,
          product_id: Number(item.product_id),
          size_id: Number(item.size_id),
          color: item.color.trim(),
          quantity_requested: Number(item.quantity_requested),
          operational_priority: item.operational_priority,
          sewing_mode:
            item.sewing_mode === "outsourced"
              ? "outsourced"
              : serviceIds.some(isSewingService)
                ? "internal"
                : null,
          notes: item.notes.trim() ? item.notes.trim() : null,
          service_ids: serviceIds
        };
      });

      const updated = await api.put<OrderDetails>(`/orders/${order.id}`, {
        client_id: Number(clientId),
        allow_printing_exception: allowPrintingException,
        notes: notes.trim() ? notes.trim() : null,
        items: payloadItems
      });
      onUpdated(updated);
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError || requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel salvar a OS."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-nav/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-lg border border-line bg-white shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
              Ordem de servico #{order.id}
            </p>
            <h2 className="mt-1 text-xl font-black text-ink">Editar OS</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-md text-muted transition hover:bg-[#FCFAF6] hover:text-ink focus-visible:focus-ring"
            aria-label="Fechar modal"
            disabled={saving}
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="space-y-5">
            {locked ? (
              <div className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm font-semibold text-ink">
                Esta OS ja possui movimentacoes. Apenas campos seguros podem ser alterados.
              </div>
            ) : null}
            {locked ? (
              <div className="rounded-md border border-accent/20 bg-accent-soft/40 p-4 text-sm font-semibold text-ink">
                Voce pode aumentar a quantidade do pedido. Reducoes abaixo do que ja foi produzido nao sao permitidas.
              </div>
            ) : null}
            {error ? (
              <div className="rounded-md border border-danger/20 bg-danger/10 p-4 text-sm font-semibold text-danger">
                {error}
              </div>
            ) : null}
            {loading ? (
              <div className="flex items-center gap-3 rounded-md border border-line bg-[#FCFAF6] p-4 text-sm font-semibold text-muted">
                <Loader2 className="animate-spin" size={18} />
                Carregando dados de edicao...
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-ink">Cliente</span>
                <select
                  className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring disabled:cursor-not-allowed disabled:opacity-70"
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  disabled={loading || saving || locked}
                >
                  {catalogs.clients
                    .filter(
                      (client) =>
                        client.is_active !== false || String(client.id) === String(order.client.id)
                    )
                    .map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                </select>
              </label>
              <Input
                label="Observacoes gerais"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={loading || saving}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-black text-ink">Itens</h3>
                {!locked ? (
                  <Button type="button" variant="secondary" onClick={() => setItems((current) => [...current, emptyItem()])}>
                    <Plus size={18} />
                    Adicionar item
                  </Button>
                ) : null}
              </div>

              {items.map((item, index) => {
                const dangerDisabled = loading || saving || locked;
                const quantityFloor = movementFloor(order, item);
                const outsourced = item.sewing_mode === "outsourced";
                return (
                  <div key={item.id ?? `new-${index}`} className="rounded-lg border border-line bg-[#FCFAF6] p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h4 className="text-base font-black text-ink">Item {index + 1}</h4>
                      {!locked ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-danger hover:text-danger"
                          onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                          disabled={items.length === 1 || saving}
                        >
                          <Trash2 size={18} />
                          Remover
                        </Button>
                      ) : null}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <SelectField
                        label="Produto"
                        value={item.product_id}
                        onChange={(event) => updateItem(index, { product_id: event.target.value })}
                        disabled={dangerDisabled}
                      >
                        <option value="">Selecione...</option>
                        {catalogs.products
                          .filter(
                            (product) =>
                              product.is_active !== false ||
                              String(product.id) === item.product_id
                          )
                          .map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                      </SelectField>
                      <SelectField
                        label="Tamanho"
                        value={item.size_id}
                        onChange={(event) => updateItem(index, { size_id: event.target.value })}
                        disabled={dangerDisabled}
                      >
                        <option value="">Selecione...</option>
                        {catalogs.sizes.map((size) => (
                          <option key={size.id} value={size.id}>
                            {size.label}
                          </option>
                        ))}
                      </SelectField>
                      <Input
                        label="Cor"
                        value={item.color}
                        onChange={(event) => updateItem(index, { color: event.target.value })}
                        disabled={loading || saving}
                      />
                      <Input
                        label="Quantidade"
                        type="number"
                        min={locked ? quantityFloor : 1}
                        value={item.quantity_requested}
                        onChange={(event) =>
                          updateItem(index, { quantity_requested: Number(event.target.value) })
                        }
                        disabled={loading || saving}
                      />
                      <SelectField
                        label="Prioridade"
                        value={item.operational_priority}
                        onChange={(event) =>
                          updateItem(index, {
                            operational_priority: event.target.value as OperationalPriority
                          })
                        }
                        disabled={loading || saving}
                      >
                        <option value="normal">Normal</option>
                        <option value="urgent">Urgente</option>
                        <option value="critical">Critico</option>
                      </SelectField>
                    </div>

                    <div className="mt-4">
                      <Input
                        label="Observacoes do item"
                        value={item.notes}
                        onChange={(event) => updateItem(index, { notes: event.target.value })}
                        disabled={loading || saving}
                      />
                    </div>

                    <div className="mt-5 space-y-3">
                      <p className="text-sm font-semibold text-ink">Producao final</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        {[
                          ["internal", "Interna"],
                          ["outsourced", "Terceirizada"]
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setProductionMode(index, value as SewingMode)}
                            disabled={dangerDisabled}
                            className={cn(
                              "flex min-h-14 items-center gap-3 rounded-lg border p-3 text-left text-sm font-semibold transition focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-70",
                              item.sewing_mode === value
                                ? "border-accent bg-accent-soft text-ink shadow-insetline"
                                : "border-line bg-white text-muted hover:bg-white"
                            )}
                          >
                            <span
                              className={cn(
                                "grid h-4 w-4 place-items-center rounded-full border",
                                item.sewing_mode === value
                                  ? "border-accent bg-accent"
                                  : "border-line bg-white"
                              )}
                            >
                              {item.sewing_mode === value ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                              ) : null}
                            </span>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {catalogs.services.map((service) => {
                        const active = item.service_ids.includes(service.id);
                        const disabled =
                          dangerDisabled || (outsourced && service.type === "confeccao");
                        return (
                          <button
                            key={service.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => toggleService(index, service.id)}
                            className={cn(
                              "rounded-lg border p-4 text-left transition focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-70",
                              active
                                ? "border-accent bg-accent-soft text-ink shadow-insetline"
                                : "border-line bg-white hover:bg-white"
                            )}
                          >
                            <span className="text-sm font-black">{service.name}</span>
                            <span className="mt-2 block text-xs font-semibold text-muted">
                              R$ {Number(service.price_per_unit ?? 0).toFixed(2).replace(".", ",")} por peca
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <label className="flex items-center gap-3 rounded-md border border-line bg-[#FCFAF6] p-3 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-line text-accent focus:focus-ring"
                checked={allowPrintingException}
                onChange={(event) => setAllowPrintingException(event.target.checked)}
                disabled={loading || saving || locked}
              />
              Permitir excecao de serigrafia
            </label>

            {!locked ? (
              <p className="text-sm font-black text-ink">
                Total estimado: R$ {estimatedTotal.toFixed(2).replace(".", ",")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void saveOrder()} isLoading={saving} disabled={loading}>
            <Check size={18} />
            Salvar OS
          </Button>
        </div>
      </div>
    </div>
  );
}

function orderToItems(order: OrderDetails): EditItem[] {
  return order.items.map((item) => ({
    id: item.id,
    product_id: String(item.product_id),
    size_id: String(item.size_id),
    color: item.color,
    quantity_requested: item.quantity_requested,
    operational_priority: item.operational_priority,
    sewing_mode: item.sewing_mode ?? "internal",
    service_ids: item.services.map((service) => service.service_id),
    notes: item.notes ?? ""
  }));
}

function orderHasMovements(order: OrderDetails): boolean {
  return (
    order.production_status !== "created" ||
    order.production_events.length > 0 ||
    order.payments.length > 0 ||
    order.outsourcings.length > 0 ||
    order.items.some(
      (item) =>
        item.quantity_cut > 0 ||
        item.quantity_printed > 0 ||
        item.quantity_sewn > 0 ||
        item.quantity_delivered > 0 ||
        item.delivered_at !== null
    )
  );
}

function movementFloor(order: OrderDetails, item: EditItem): number {
  const snapshotItem = item.id ? order.items.find((orderItem) => orderItem.id === item.id) : null;
  if (!snapshotItem) return 1;
  const outsourcedMax = order.outsourcings
    .filter((outsourcing) => outsourcing.order_item_id === snapshotItem.id)
    .reduce(
      (max, outsourcing) => Math.max(max, outsourcing.quantity_sent, outsourcing.quantity_returned),
      0
    );
  return Math.max(
    snapshotItem.quantity_cut,
    snapshotItem.quantity_printed,
    snapshotItem.quantity_sewn,
    snapshotItem.quantity_delivered,
    outsourcedMax
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
};

function SelectField({ label, className, children, ...props }: SelectFieldProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <select
        className={cn(
          "h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring disabled:cursor-not-allowed disabled:opacity-70",
          className
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
