"use client";

import { Scissors, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { OrderDetails, OrderItem } from "@/components/orders/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";

type Props = {
  order: OrderDetails | null;
  item: OrderItem | null;
  open: boolean;
  onClose: () => void;
  onUpdated: (order: OrderDetails) => void;
};

export function ProductionCutModal({ order, item, open, onClose, onUpdated }: Props) {
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && order && item) {
      setQuantity("");
      setNotes("");
      setError(null);
    }
  }, [open, order, item]);

  if (!open || !order || !item) return null;

  const missing = Math.max(item.quantity_requested - item.quantity_cut, 0);

  async function submit() {
    if (!order) return;
    if (!item) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await api.post<OrderDetails>(`/orders/${order.id}/items/${item.id}/cut`, {
        quantity: Number(quantity),
        notes: notes.trim() || null
      });
      onUpdated(updated);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel registrar o corte.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <div className="w-full max-w-md rounded-lg border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-accent-soft text-accent-dark">
              <Scissors size={18} />
            </div>
            <div>
              <h2 className="text-lg font-black text-ink">Registrar corte</h2>
              <p className="text-sm font-semibold text-muted">
                OS #{order.id} - {item.product.name} tamanho {item.size.label}
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
          <Input
            label="Quantidade cortada agora"
            type="number"
            min="1"
            max={missing}
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Observacao operacional</span>
            <textarea
              className="min-h-24 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink shadow-insetline transition focus:focus-ring"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <div className="grid grid-cols-3 gap-3 rounded-md border border-line bg-[#FCFAF6] p-3 text-xs font-semibold leading-5 text-muted">
            <Metric label="Solicitado" value={item.quantity_requested} />
            <Metric label="Ja cortado" value={item.quantity_cut} />
            <Metric label="Faltam" value={missing} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" isLoading={loading} disabled={!quantity} onClick={submit}>
              Registrar
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
      <p className="text-[11px] uppercase tracking-[0.1em]">{label}</p>
      <p className="mt-1 text-base font-black text-ink">{value}</p>
    </div>
  );
}
