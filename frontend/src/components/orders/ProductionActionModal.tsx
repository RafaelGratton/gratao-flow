"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { OrderDetails } from "@/components/orders/types";
import { api } from "@/lib/api";

type ActionType = "cut" | "print" | "sew";

type ProductionActionModalProps = {
  order: OrderDetails;
  action: ActionType | null;
  open: boolean;
  onClose: () => void;
  onUpdated: (order: OrderDetails) => void;
};

const labels: Record<ActionType, string> = {
  cut: "Registrar corte",
  print: "Registrar serigrafia",
  sew: "Registrar confeccao"
};

export function ProductionActionModal({
  order,
  action,
  open,
  onClose,
  onUpdated
}: ProductionActionModalProps) {
  const [quantity, setQuantity] = useState("");
  const [printType, setPrintType] = useState("front");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || action === null) return null;

  async function submit() {
    if (action === null) return;

    setLoading(true);
    setError(null);
    try {
      const payload =
        action === "cut"
          ? { quantity_cut: Number(quantity) }
          : action === "print"
            ? { quantity: Number(quantity), print_type: printType }
            : { quantity: Number(quantity) };
      const updated = await api.post<OrderDetails>(`/orders/${order.id}/${action}`, payload);
      onUpdated(updated);
      setQuantity("");
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Nao foi possivel registrar producao."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <div className="w-full max-w-md rounded-lg border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-black text-ink">{labels[action]}</h2>
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
            label={action === "cut" ? "Quantidade cortada total" : "Quantidade"}
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          {action === "print" ? (
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-ink">Tipo</span>
              <select
                className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
                value={printType}
                onChange={(event) => setPrintType(event.target.value)}
              >
                <option value="front">Frente</option>
                <option value="front_back">Frente e costas</option>
              </select>
            </label>
          ) : null}
          <div className="rounded-md border border-line bg-[#FCFAF6] p-3 text-xs font-semibold leading-5 text-muted">
            Corte informa o total acumulado. Serigrafia e confeccao registram incrementos.
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
