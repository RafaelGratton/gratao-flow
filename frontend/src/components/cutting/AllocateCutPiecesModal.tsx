"use client";

import { ArrowRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { OrderDetails, OrderItem } from "@/components/orders/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";

type Props = {
  order: OrderDetails | null;
  item: OrderItem | null;
  availableStock: number;
  open: boolean;
  onClose: () => void;
  onUpdated: (order: OrderDetails) => void;
};

export function AllocateCutPiecesModal({
  order,
  item,
  availableStock,
  open,
  onClose,
  onUpdated
}: Props) {
  const missing = item ? Math.max(item.quantity_requested - item.quantity_cut, 0) : 0;
  const maximum = Math.min(availableStock, missing);
  const paused = Boolean(order?.production_paused);
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setQuantity(maximum > 0 ? String(maximum) : "");
      setNotes("");
      setError(null);
    }
  }, [maximum, open]);

  const amount = useMemo(() => Number(quantity), [quantity]);

  if (!open || !order || !item) return null;

  async function submit() {
    if (!order || !item) return;
    if (paused) {
      setError("A producao desta OS esta pausada. Retome a OS antes de destinar pecas.");
      return;
    }
    if (!Number.isInteger(amount) || amount <= 0 || amount > maximum) {
      setError(`Informe uma quantidade entre 1 e ${maximum}.`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const updated = await api.post<OrderDetails>(
        `/orders/${order.id}/items/${item.id}/allocate-cut-pieces`,
        { quantity: amount, notes: notes.trim() || null }
      );
      onUpdated(updated);
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel destinar as pecas para a OS."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <div className="w-full max-w-lg rounded-lg border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-accent-soft text-accent-dark">
              <ArrowRight size={18} />
            </div>
            <div>
              <h2 className="text-lg font-black text-ink">Destinar pecas para a OS</h2>
              <p className="text-sm font-semibold text-muted">
                OS #{order.id} - {order.client.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-md text-muted transition hover:bg-[#FCFAF6] hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 p-5">
          {error ? (
            <div className="rounded-md border border-danger/20 bg-danger/10 p-3 text-sm font-semibold text-danger">
              {error}
            </div>
          ) : null}
          {paused ? (
            <div className="rounded-md border border-warning/25 bg-warning/10 p-3 text-sm font-semibold text-warning">
              Producao pausada. Retome a OS para destinar pecas.
            </div>
          ) : null}
          <p className="text-sm font-semibold text-muted">
            {item.product.name} / Tam. {item.size.label} / {item.color || "Sem cor"}
          </p>
          <div className="grid grid-cols-2 gap-3 rounded-md border border-line bg-[#FCFAF6] p-3">
            <Metric label="Solicitado" value={item.quantity_requested} />
            <Metric label="Ja destinado" value={item.quantity_cut} />
            <Metric label="Falta destinar" value={missing} />
            <Metric label="Disponivel em estoque" value={availableStock} />
          </div>
          <Input
            label="Quantidade a destinar"
            type="number"
            min="1"
            max={maximum}
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Observacao (opcional)</span>
            <textarea
              className="min-h-20 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink shadow-insetline transition focus:focus-ring"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <p className="text-xs font-semibold leading-5 text-muted">
            A destinacao reduz o saldo compativel em estoque e libera somente esta quantidade
            para o fluxo produtivo da OS.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              isLoading={loading}
              disabled={paused || !quantity || maximum <= 0 || amount <= 0 || amount > maximum}
              onClick={submit}
            >
              Destinar para OS
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className="mt-1 text-lg font-black text-ink">{value}</p>
    </div>
  );
}
