"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { OrderDetails } from "@/components/orders/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

type Props = {
  order: OrderDetails | null;
  onClose: () => void;
  onUpdated: (order: OrderDetails) => void;
};

const methods = [
  ["pix", "Pix"],
  ["cash", "Dinheiro"],
  ["card", "Cartao"],
  ["boleto", "Boleto"]
];

export function FinancePaymentModal({ order, onClose, onUpdated }: Props) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      setAmount(order.amount_due);
      setPaymentMethod("pix");
      setNotes("");
      setError(null);
    }
  }, [order]);

  if (!order) return null;

  async function submit() {
    if (!order) return;
    const currentOrder = order;
    setLoading(true);
    setError(null);
    try {
      const updated = await api.post<OrderDetails>(`/orders/${currentOrder.id}/payments`, {
        amount,
        payment_method: paymentMethod,
        notes: notes.trim() || null
      });
      onUpdated(updated);
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Nao foi possivel adicionar pagamento."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <div className="w-full max-w-lg rounded-lg border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-dark">OS #{order.id}</p>
            <h2 className="mt-1 text-lg font-black text-ink">Adicionar pagamento</h2>
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
          <div className="grid gap-3 rounded-md border border-line bg-[#FCFAF6] p-4 text-sm md:grid-cols-3">
            <div>
              <p className="font-semibold text-muted">Total</p>
              <p className="mt-1 font-black text-ink">{formatCurrency(order.total_amount)}</p>
            </div>
            <div>
              <p className="font-semibold text-muted">Pago</p>
              <p className="mt-1 font-black text-ink">{formatCurrency(order.amount_paid)}</p>
            </div>
            <div>
              <p className="font-semibold text-muted">Pendente</p>
              <p className="mt-1 font-black text-danger">{formatCurrency(order.amount_due)}</p>
            </div>
          </div>
          {error ? (
            <div className="rounded-md border border-danger/20 bg-danger/10 p-3 text-sm font-semibold text-danger">
              {error}
            </div>
          ) : null}
          <Input
            label="Valor"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Forma</span>
            <select
              className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              {methods.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Observacao</span>
            <textarea
              className="min-h-24 w-full rounded-md border border-line bg-white px-3 py-3 text-sm text-ink shadow-insetline transition placeholder:text-muted/70 focus:focus-ring"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Opcional"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" isLoading={loading} disabled={!amount} onClick={submit}>
              Salvar pagamento
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
