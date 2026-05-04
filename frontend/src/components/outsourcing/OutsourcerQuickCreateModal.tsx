"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Outsourcer } from "@/components/orders/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (outsourcer: Outsourcer) => void;
};

export function OutsourcerQuickCreateModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setPhone("");
      setNotes("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function submit() {
    if (!name.trim() || !phone.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const created = await api.post<Outsourcer>("/outsourcers", {
        name: name.trim(),
        phone: phone.trim(),
        notes: notes.trim() || null
      });
      onCreated(created);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel cadastrar terceirizado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/35 p-4">
      <div className="w-full max-w-md rounded-lg border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-black text-ink">Cadastrar terceirizado</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md text-muted transition hover:bg-[#FCFAF6] hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 p-5">
          {error ? <div className="rounded-md border border-danger/20 bg-danger/10 p-3 text-sm font-semibold text-danger">{error}</div> : null}
          <Input label="Nome" value={name} onChange={(event) => setName(event.target.value)} />
          <Input label="Telefone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Observacoes</span>
            <textarea className="min-h-24 w-full rounded-md border border-line bg-white px-3 py-3 text-sm text-ink shadow-insetline transition focus:focus-ring" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="button" isLoading={loading} disabled={!name.trim() || !phone.trim()} onClick={submit}>Cadastrar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
