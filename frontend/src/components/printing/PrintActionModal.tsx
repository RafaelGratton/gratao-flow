"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { OrderDetails, OrderItem } from "@/components/orders/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";

type PrintActionModalProps = {
  order: OrderDetails | null;
  item?: OrderItem | null;
  open: boolean;
  onClose: () => void;
  onUpdated: (order: OrderDetails) => void;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function PrintActionModal({ order, item, open, onClose, onUpdated }: PrintActionModalProps) {
  const [quantity, setQuantity] = useState("");
  const [printType, setPrintType] = useState<"front" | "front_back">("front");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productName = normalize(item?.product.name ?? order?.product.name ?? "");
  const onlyFront = productName === "casaco";
  const requiresException =
    productName.startsWith("cal") || productName === "short" || productName === "short saia";
  const quantityCut = item?.quantity_cut ?? order?.quantity_cut ?? 0;
  const quantityPrinted = item?.quantity_printed ?? order?.quantity_printed ?? 0;
  const remaining = Math.max(quantityCut - quantityPrinted, 0);
  const paused = Boolean(order?.production_paused);

  useEffect(() => {
    if (open) {
      setQuantity("");
      setPrintType("front");
      setNotes("");
      setError(null);
    }
  }, [open, order?.id]);

  useEffect(() => {
    if (onlyFront) {
      setPrintType("front");
    }
  }, [onlyFront]);

  const validation = useMemo(() => {
    const amount = Number(quantity);
    if (paused) return "A producao desta OS esta pausada. Retome a OS antes de registrar DTF.";
    if (!quantity) return null;
    if (!Number.isInteger(amount) || amount <= 0) return "Informe uma quantidade inteira maior que zero.";
    if (amount > remaining) return `Restam apenas ${remaining} pecas para DTF nesta OS.`;
    return null;
  }, [paused, quantity, remaining]);

  if (!open || !order) return null;

  async function submit() {
    if (!order || validation) return;
    setLoading(true);
    setError(null);

    try {
      const path = item
        ? `/orders/${order.id}/items/${item.id}/print`
        : `/orders/${order.id}/print`;
      const updated = await api.post<OrderDetails>(path, {
        quantity: Number(quantity),
        print_type: printType,
        notes: notes.trim() || null
      });
      onUpdated(updated);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel registrar DTF.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <div className="w-full max-w-lg rounded-lg border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-dark">
              OS #{order.id}{item ? ` - ${item.product.name} tamanho ${item.size.label}` : ""}
            </p>
            <h2 className="text-lg font-black text-ink">Registrar DTF</h2>
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
              Producao pausada. Retome a OS para registrar DTF.
            </div>
          ) : null}
          {requiresException ? (
            <div className="rounded-md border border-warning/25 bg-warning/10 p-3 text-sm font-semibold leading-5 text-warning">
              Este produto depende de excecao configurada na OS. Se a excecao nao estiver ativa, o backend vai bloquear o registro.
            </div>
          ) : null}
          <div className="grid gap-3 rounded-md border border-line bg-[#FCFAF6] p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Destinado para OS</p>
              <p className="mt-1 text-xl font-black text-ink">{quantityCut}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">DTF realizado</p>
              <p className="mt-1 text-xl font-black text-ink">{quantityPrinted}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Disponivel para DTF</p>
              <p className="mt-1 text-xl font-black text-ink">{remaining}</p>
            </div>
          </div>
          <Input
            label="Quantidade"
            type="number"
            min="1"
            max={remaining}
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Tipo</span>
            <select
              className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring disabled:opacity-70"
              value={printType}
              disabled={onlyFront}
              onChange={(event) => setPrintType(event.target.value as "front" | "front_back")}
            >
              <option value="front">Frente</option>
              {!onlyFront ? <option value="front_back">Frente e costas</option> : null}
            </select>
          </label>
          {onlyFront ? (
            <p className="text-sm font-semibold text-muted">Casaco permite apenas DTF frente.</p>
          ) : null}
          {item?.dtf_notes ? (
            <div className="rounded-md border border-accent/25 bg-accent-soft/30 p-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent-dark">Observacao DTF</p>
              <p className="mt-1 text-sm font-semibold text-ink">{item.dtf_notes}</p>
            </div>
          ) : null}
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Observacao operacional</span>
            <textarea
              className="min-h-24 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink shadow-insetline transition focus:focus-ring"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          {validation ? <p className="text-sm font-semibold text-danger">{validation}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" isLoading={loading} disabled={paused || !quantity || Boolean(validation)} onClick={submit}>
              Registrar DTF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
