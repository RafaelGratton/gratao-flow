"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { OrderDetails, OrderOutsourcing } from "@/components/orders/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";

type Props = {
  orderId: number | null;
  outsourcing: OrderOutsourcing | null;
  open: boolean;
  onClose: () => void;
  onReturned: (order: OrderDetails) => void;
};

export function OutsourcingReturnModal({ orderId, outsourcing, open, onClose, onReturned }: Props) {
  const [quantityReturned, setQuantityReturned] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = outsourcing ? outsourcing.quantity_sent - outsourcing.quantity_returned : 0;

  useEffect(() => {
    if (open) {
      setQuantityReturned("");
      setNotes("");
      setError(null);
    }
  }, [open, outsourcing?.id]);

  const validation = useMemo(() => {
    const quantity = Number(quantityReturned);
    if (!quantityReturned) return null;
    if (!Number.isInteger(quantity) || quantity <= 0) return "Informe uma quantidade inteira maior que zero.";
    if (quantity > remaining) return `Restam ${remaining} pecas para retorno.`;
    return null;
  }, [quantityReturned, remaining]);

  if (!open || !outsourcing || orderId === null) return null;

  async function submit() {
    if (orderId === null || !outsourcing || validation) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await api.post<OrderDetails>(`/orders/${orderId}/outsourcing/${outsourcing.id}/return`, {
        quantity_returned: Number(quantityReturned),
        notes: notes || null
      });
      onReturned(updated);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel registrar retorno.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <div className="w-full max-w-md rounded-lg border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-black text-ink">Registrar retorno</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md text-muted transition hover:bg-[#FCFAF6] hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 p-5">
          {error ? <div className="rounded-md border border-danger/20 bg-danger/10 p-3 text-sm font-semibold text-danger">{error}</div> : null}
          <Input label={`Quantidade retornada (restante: ${remaining})`} type="number" min="1" max={remaining} step="1" value={quantityReturned} onChange={(event) => setQuantityReturned(event.target.value)} />
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Observacao</span>
            <textarea className="min-h-24 w-full rounded-md border border-line bg-white px-3 py-3 text-sm text-ink shadow-insetline transition focus:focus-ring" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          {validation ? <p className="text-sm font-semibold text-danger">{validation}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="button" isLoading={loading} disabled={!quantityReturned || Boolean(validation)} onClick={submit}>Registrar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
