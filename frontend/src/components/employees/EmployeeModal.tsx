"use client";

import { Check, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { Employee } from "./types";

type Props = {
  open: boolean;
  employee: Employee | null;
  onClose: () => void;
  onSaved: (employee: Employee) => void;
};

const initialState = {
  name: "",
  role: "",
  phone: "",
  daily_rate: "120.00",
  standard_daily_hours: "8",
  standard_lunch_hours: "1",
  is_active: true,
  notes: ""
};

export function EmployeeModal({ open, employee, onClose, onSaved }: Props) {
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        employee
          ? {
              name: employee.name,
              role: employee.role ?? "",
              phone: employee.phone ?? "",
              daily_rate: employee.daily_rate,
              standard_daily_hours: employee.standard_daily_hours,
              standard_lunch_hours: employee.standard_lunch_hours,
              is_active: employee.is_active,
              notes: employee.notes ?? ""
            }
          : initialState
      );
      setError(null);
    }
  }, [employee, open]);

  const hourlyRate = useMemo(() => {
    const dailyRate = Number(form.daily_rate);
    const standardHours = Number(form.standard_daily_hours);
    if (!Number.isFinite(dailyRate) || !Number.isFinite(standardHours) || standardHours <= 0) return 0;
    return dailyRate / standardHours;
  }, [form.daily_rate, form.standard_daily_hours]);

  if (!open) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Informe o nome do funcionario.");
      return;
    }
    if (Number(form.daily_rate) < 0 || Number.isNaN(Number(form.daily_rate))) {
      setError("O valor da diaria deve ser maior ou igual a zero.");
      return;
    }
    if (Number(form.standard_daily_hours) <= 0 || Number.isNaN(Number(form.standard_daily_hours))) {
      setError("As horas padrao da diaria devem ser maiores que zero.");
      return;
    }
    if (Number(form.standard_lunch_hours) < 0 || Number.isNaN(Number(form.standard_lunch_hours))) {
      setError("O intervalo padrao deve ser maior ou igual a zero.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      role: form.role.trim() || null,
      phone: form.phone.trim() || null,
      daily_rate: form.daily_rate,
      standard_daily_hours: form.standard_daily_hours,
      standard_lunch_hours: form.standard_lunch_hours,
      is_active: form.is_active,
      notes: form.notes.trim() || null
    };

    setSubmitting(true);
    setError(null);
    try {
      const saved = employee
        ? await api.put<Employee>(`/employees/${employee.id}`, payload)
        : await api.post<Employee>("/employees", payload);
      onSaved(saved);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel salvar o funcionario.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-nav/45 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-lg border border-line bg-white shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Funcionarios</p>
            <h2 className="mt-1 text-xl font-black text-ink">{employee ? "Editar funcionario" : "Novo funcionario"}</h2>
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
        <form className="max-h-[calc(92vh-76px)] space-y-4 overflow-y-auto p-5" onSubmit={submit}>
          {error ? (
            <div className="rounded-md border border-danger/20 bg-danger/10 p-3 text-sm font-semibold text-danger">
              {error}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Nome" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            <Input label="Funcao" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))} />
            <Input label="Telefone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
            <Input
              label="Valor da diaria"
              type="number"
              min="0"
              step="0.01"
              value={form.daily_rate}
              onChange={(event) => setForm((current) => ({ ...current, daily_rate: event.target.value }))}
            />
            <Input
              label="Horas padrao da diaria"
              type="number"
              min="0.25"
              step="0.25"
              value={form.standard_daily_hours}
              onChange={(event) => setForm((current) => ({ ...current, standard_daily_hours: event.target.value }))}
            />
            <Input
              label="Intervalo padrao de almoco"
              type="number"
              min="0"
              step="0.25"
              value={form.standard_lunch_hours}
              onChange={(event) => setForm((current) => ({ ...current, standard_lunch_hours: event.target.value }))}
            />
          </div>
          <div className="rounded-md border border-line bg-[#FCFAF6] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Valor hora derivado</p>
            <p className="mt-2 text-2xl font-black text-ink">{formatCurrency(hourlyRate)}</p>
          </div>
          <label className="flex items-center gap-3 rounded-md border border-line bg-[#FCFAF6] p-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-line text-accent focus:focus-ring"
              checked={form.is_active}
              onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
            />
            Funcionario ativo
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Observacoes</span>
            <textarea
              className="min-h-24 w-full rounded-md border border-line bg-white px-3 py-3 text-sm text-ink shadow-insetline transition placeholder:text-muted/70 focus:focus-ring"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
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
