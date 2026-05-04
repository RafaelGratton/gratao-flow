"use client";

import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import type { Employee } from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (employee: Employee) => void;
};

const initialState = {
  name: "",
  phone: "",
  daily_rate: "0",
  is_active: true
};

export function EmployeeModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initialState);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Informe o nome do funcionario.");
      return;
    }
    if (Number.isNaN(Number(form.daily_rate)) || Number(form.daily_rate) < 0) {
      setError("O valor da diaria deve ser maior ou igual a zero.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const employee = await api.post<Employee>("/employees", {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        daily_rate: form.daily_rate,
        is_active: form.is_active
      });
      onCreated(employee);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel criar o funcionario.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-nav/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-lg border border-line bg-white shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Funcionários</p>
            <h2 className="mt-1 text-xl font-black text-ink">Novo funcionario</h2>
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
          <Input label="Nome" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          <Input label="Telefone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
          <Input
            label="Valor diaria"
            type="number"
            min="0"
            step="0.01"
            value={form.daily_rate}
            onChange={(event) => setForm((current) => ({ ...current, daily_rate: event.target.value }))}
          />
          <label className="flex items-center gap-3 rounded-md border border-line bg-[#FCFAF6] p-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-line text-accent focus:focus-ring"
              checked={form.is_active}
              onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
            />
            Funcionario ativo
          </label>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={submitting}>
              <Check size={18} />
              Salvar funcionario
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
