"use client";

import { Shirt, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

export function ProductionSewModal({ order, item, open, onClose, onUpdated }: Props) {
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestedQuantity = useMemo(() => {
    if (!item) return 0;
    const available = Math.min(item.quantity_cut, item.quantity_requested);
    return Math.max(available - item.quantity_sewn, 0);
  }, [item]);

  useEffect(() => {
    if (open && order && item) {
      setQuantity("");
      setError(null);
    }
  }, [open, order, item]);

  if (!open || !order || !item) return null;

  async function submit() {
    if (!order || !item) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await api.post<OrderDetails>(`/orders/${order.id}/items/${item.id}/sew`, {
        quantity: Number(quantity)
      });
      onUpdated(updated);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel registrar a confeccao.");
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
              <Shirt size={18} />
            </div>
            <div>
              <h2 className="text-lg font-black text-ink">Registrar confeccao</h2>
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
            label="Quantidade confeccionada agora"
            type="number"
            min="1"
            max={suggestedQuantity}
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <div className="rounded-md border border-line bg-[#FCFAF6] p-3 text-xs font-semibold leading-5 text-muted">
            Disponivel para confeccao: {suggestedQuantity}. O registro e incremental por item.
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
