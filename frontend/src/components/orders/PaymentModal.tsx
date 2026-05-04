"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { OrderDetails } from "@/components/orders/types";
import { api } from "@/lib/api";

type PaymentModalProps = {
  orderId: number;
  open: boolean;
  onClose: () => void;
  onUpdated: (order: OrderDetails) => void;
};

const methods = [
  ["pix", "Pix"],
  ["cash", "Dinheiro"],
  ["card", "Cartao"],
  ["boleto", "Boleto"]
];

export function PaymentModal({ orderId, open, onClose, onUpdated }: PaymentModalProps) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const order = await api.post<OrderDetails>(`/orders/${orderId}/payments`, {
        amount,
        payment_method: paymentMethod
      });
      onUpdated(order);
      setAmount("");
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
      <div className="w-full max-w-md rounded-lg border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-black text-ink">Adicionar pagamento</h2>
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
            label="Valor"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Metodo</span>
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
