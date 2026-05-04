"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { WeeklyClosing, WeeklyClosingCreate } from "@/components/weekly-closings/types";
import { api } from "@/lib/api";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (closing: WeeklyClosing) => void;
};

export function WeeklyClosingCreateModal({ open, onClose, onCreated }: Props) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const payload: WeeklyClosingCreate = {
        start_date: startDate,
        end_date: endDate,
        notes: notes.trim() || null
      };
      const closing = await api.post<WeeklyClosing>("/weekly-closings", payload);
      onCreated(closing);
      setStartDate("");
      setEndDate("");
      setNotes("");
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Nao foi possivel criar o fechamento semanal."
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
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-dark">Periodo</p>
            <h2 className="mt-1 text-lg font-black text-ink">Novo fechamento</h2>
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
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Data inicial" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            <Input label="Data final" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Notas</span>
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
            <Button type="button" isLoading={loading} disabled={!startDate || !endDate} onClick={submit}>
              Criar fechamento
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
