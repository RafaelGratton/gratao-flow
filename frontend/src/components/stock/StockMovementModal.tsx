"use client";

import { Check, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import type { StockItem, StockItemDetail } from "./types";

type MovementMode = "entry" | "exit" | "adjust";

type Props = {
  item: StockItem | null;
  mode: MovementMode | null;
  onClose: () => void;
  onSaved: (item: StockItemDetail) => void;
};

const titles: Record<MovementMode, string> = {
  entry: "Registrar entrada",
  exit: "Registrar saida",
  adjust: "Registrar ajuste"
};

export function StockMovementModal({ item, mode, onClose, onSaved }: Props) {
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const open = Boolean(item && mode);

  useEffect(() => {
    if (open) {
      setQuantity(mode === "adjust" ? item?.quantity ?? "0" : "");
      setNotes("");
      setError(null);
    }
  }, [item, mode, open]);

  const helper = useMemo(() => {
    if (!item || !mode) return "";
    return `Saldo atual: ${Number(item.quantity).toLocaleString("pt-BR")}`;
  }, [item, mode]);

  if (!open || !item || !mode) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item) {
      setError("Selecione um item valido antes de movimentar o estoque.");
      return;
    }
    if (!mode) {
      setError("Selecione o tipo de movimentacao antes de continuar.");
      return;
    }

    const selectedItem = item;
    const selectedMode = mode;
    const numericQuantity = Number(quantity);
    if (Number.isNaN(numericQuantity) || numericQuantity < 0 || (selectedMode !== "adjust" && numericQuantity <= 0)) {
      setError(selectedMode === "adjust" ? "Informe uma quantidade final maior ou igual a zero." : "Informe uma quantidade maior que zero.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const path =
        selectedMode === "adjust"
          ? `/stock/items/${selectedItem.id}/adjust`
          : `/stock/items/${selectedItem.id}/${selectedMode}`;
      const updated = await api.post<StockItemDetail>(path, {
        quantity,
        notes: notes.trim() || null
      });
      onSaved(updated);
      onClose();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Nao foi possivel registrar a movimentacao.";
      setError(message.includes("negative") ? "Saida bloqueada: o estoque nao pode ficar negativo." : message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-nav/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-lg border border-line bg-white shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">{item.name}</p>
            <h2 className="mt-1 text-xl font-black text-ink">{titles[mode]}</h2>
            <p className="mt-1 text-sm text-muted">{helper}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-md text-muted transition hover:bg-[#FCFAF6] hover:text-ink focus-visible:focus-ring"
            aria-label="Fechar modal"
            disabled={submitting}
          >
            <X size={18} />
          </button>
        </div>
        <form className="space-y-4 p-5" onSubmit={submit}>
          {error ? (
            <div className="rounded-md border border-danger/20 bg-danger/10 p-3 text-sm font-semibold text-danger">
              {error}
            </div>
          ) : null}
          <Input
            label={mode === "adjust" ? "Quantidade final" : "Quantidade"}
            type="number"
            min="0"
            step="0.01"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Observacoes</span>
            <textarea
              className="min-h-24 w-full rounded-md border border-line bg-white px-3 py-3 text-sm text-ink shadow-insetline transition placeholder:text-muted/70 focus:focus-ring"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={submitting} disabled={!item || !mode}>
              <Check size={18} />
              Registrar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
