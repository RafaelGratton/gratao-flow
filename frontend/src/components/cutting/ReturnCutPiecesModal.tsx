"use client";

import { Undo2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { OrderDetails, OrderItem } from "@/components/orders/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";

type Props = {
  order: OrderDetails;
  item: OrderItem | null;
  open: boolean;
  onClose: () => void;
  onUpdated: (order: OrderDetails) => void;
};

export function ReturnCutPiecesModal({ order, item, open, onClose, onUpdated }: Props) {
  const committed = item ? committedQuantity(order, item) : 0;
  const maximum = item ? Math.max(item.quantity_cut - committed, 0) : 0;
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = useMemo(() => Number(quantity), [quantity]);

  useEffect(() => {
    if (open) {
      setQuantity(maximum > 0 ? String(maximum) : "");
      setNotes("");
      setError(null);
    }
  }, [maximum, open]);

  if (!open || !item) return null;

  async function submit() {
    if (!item) return;
    if (!Number.isInteger(amount) || amount <= 0 || amount > maximum) {
      setError(`Informe uma quantidade entre 1 e ${maximum}.`);
      return;
    }
    if (!notes.trim()) {
      setError("Informe o motivo da devolucao.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const updated = await api.post<OrderDetails>(
        `/orders/${order.id}/items/${item.id}/return-cut-pieces-to-stock`,
        { quantity: amount, notes: notes.trim() }
      );
      onUpdated(updated);
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel devolver as pecas ao estoque."
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
              <Undo2 size={18} />
            </div>
            <div>
              <h2 className="text-lg font-black text-ink">Devolver pecas ao estoque</h2>
              <p className="text-sm font-semibold text-muted">
                OS #{order.id} - {item.product.name}
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
          <p className="text-sm font-semibold text-muted">
            {item.product.name} / Tam. {item.size.label} / {item.color || "Sem cor"}
          </p>
          <div className="grid grid-cols-3 gap-3 rounded-md border border-line bg-[#FCFAF6] p-3">
            <Metric label="Destinado para a OS" value={item.quantity_cut} />
            <Metric label="Ja comprometido" value={committed} />
            <Metric label="Estimativa devolvivel" value={maximum} />
          </div>
          <p className="rounded-md border border-warning/20 bg-warning/5 p-3 text-xs font-semibold leading-5 text-muted">
            Apenas pecas ainda nao processadas podem ser devolvidas. O backend confirmara o
            limite no momento da operacao.
          </p>
          <Input
            label="Quantidade a devolver"
            type="number"
            min="1"
            max={maximum}
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Motivo / observacao *</span>
            <textarea
              className="min-h-24 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink shadow-insetline transition focus:focus-ring"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              required
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              isLoading={loading}
              disabled={!quantity || !notes.trim() || maximum <= 0 || amount <= 0 || amount > maximum}
              onClick={submit}
            >
              Devolver ao estoque
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function committedQuantity(order: OrderDetails, item: OrderItem) {
  const outsourced = order.outsourcings
    .filter((entry) => entry.order_item_id === item.id && entry.status !== "cancelled")
    .reduce((total, entry) => total + entry.quantity_sent, 0);

  return Math.max(item.quantity_printed, item.quantity_sewn, item.quantity_delivered, outsourced);
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className="mt-1 text-lg font-black text-ink">{value}</p>
    </div>
  );
}
