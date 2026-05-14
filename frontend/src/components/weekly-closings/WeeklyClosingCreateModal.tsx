"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Employee, WorkLog } from "@/components/employees/types";
import type { WeeklyClosing, WeeklyClosingCreate } from "@/components/weekly-closings/types";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

type Props = {
  open: boolean;
  employees: Employee[];
  workLogs: WorkLog[];
  onClose: () => void;
  onCreated: (closing: WeeklyClosing) => void;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function WeeklyClosingCreateModal({ open, employees, workLogs, onClose, onCreated }: Props) {
  const [employeeId, setEmployeeId] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [discounts, setDiscounts] = useState("0.00");
  const [advances, setAdvances] = useState("0.00");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedLogs = useMemo(() => {
    if (!employeeId || !startDate || !endDate) return [];
    const id = Number(employeeId);
    return workLogs.filter(
      (log) =>
        log.employee_id === id &&
        log.work_date >= startDate &&
        log.work_date <= endDate &&
        log.weekly_closing_id === null
    );
  }, [employeeId, endDate, startDate, workLogs]);

  const preview = useMemo(() => {
    const base = selectedLogs.reduce((total, log) => total + Number(log.base_amount), 0);
    const overtime = selectedLogs.reduce((total, log) => total + Number(log.overtime_amount), 0);
    const net = selectedLogs.reduce((total, log) => total + Number(log.net_hours), 0);
    const extra = selectedLogs.reduce((total, log) => total + Number(log.overtime_hours), 0);
    const total = base + overtime - Number(discounts || 0) - Number(advances || 0);
    return { base, overtime, net, extra, total };
  }, [advances, discounts, selectedLogs]);

  if (!open) return null;

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const payload: WeeklyClosingCreate = {
        employee_id: Number(employeeId),
        start_date: startDate,
        end_date: endDate,
        discounts,
        advances,
        notes: notes.trim() || null
      };
      const closing = await api.post<WeeklyClosing>("/weekly-closings", payload);
      onCreated(closing);
      setEmployeeId("");
      setDiscounts("0.00");
      setAdvances("0.00");
      setNotes("");
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel criar o fechamento semanal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-dark">Funcionario</p>
            <h2 className="mt-1 text-lg font-black text-ink">Novo fechamento semanal</h2>
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
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Funcionario</span>
            <select
              className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
            >
              <option value="">Selecione</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                  {!employee.is_active ? " (inativo)" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Semana inicial" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            <Input label="Semana final" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            <Input label="Descontos" type="number" min="0" step="0.01" value={discounts} onChange={(event) => setDiscounts(event.target.value)} />
            <Input label="Adiantamentos" type="number" min="0" step="0.01" value={advances} onChange={(event) => setAdvances(event.target.value)} />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <PreviewTile label="Dias" value={String(selectedLogs.filter((log) => Number(log.net_hours) > 0).length)} />
            <PreviewTile label="Liquidas" value={`${preview.net.toFixed(2)}h`} />
            <PreviewTile label="Extras" value={`${preview.extra.toFixed(2)}h`} />
            <PreviewTile label="Total" value={formatCurrency(preview.total)} strong />
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
            <Button type="button" isLoading={loading} disabled={!employeeId || !startDate || !endDate} onClick={submit}>
              Criar fechamento
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewTile({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-md border border-line bg-[#FCFAF6] p-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className={strong ? "mt-2 text-xl font-black text-ink" : "mt-2 text-lg font-black text-ink"}>{value}</p>
    </div>
  );
}
