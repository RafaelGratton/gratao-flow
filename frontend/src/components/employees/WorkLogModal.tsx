"use client";

import { Check, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { Employee, WorkLog, WorkType } from "./types";

type Props = {
  employee: Employee | null;
  onClose: () => void;
  onCreated: (workLog: WorkLog) => void;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

const workTypeLabels: Record<WorkType, string> = {
  full_day: "Diaria",
  half_day: "Meio periodo",
  absence: "Falta"
};

export function WorkLogModal({ employee, onClose, onCreated }: Props) {
  const [workDate, setWorkDate] = useState(today());
  const [workType, setWorkType] = useState<WorkType>("full_day");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (employee) {
      setWorkDate(today());
      setWorkType("full_day");
      setNotes("");
      setError(null);
    }
  }, [employee]);

  const preview = useMemo(() => {
    if (!employee) return 0;
    if (workType === "full_day") return Number(employee.daily_rate);
    if (workType === "half_day") return Number(employee.daily_rate) / 2;
    return 0;
  }, [employee, workType]);

  if (!employee) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employee) {
      setError("Selecione um funcionario antes de registrar o dia.");
      return;
    }
    if (!workDate) {
      setError("Informe a data.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const workLog = await api.post<WorkLog>(`/employees/${employee.id}/work-logs`, {
        work_date: workDate,
        work_type: workType,
        notes: notes.trim() || null
      });
      onCreated(workLog);
      onClose();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Nao foi possivel registrar o dia.";
      setError(message.includes("already has") ? "Ja existe registro para este funcionario nessa data." : message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-nav/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-lg border border-line bg-white shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">{employee.name}</p>
            <h2 className="mt-1 text-xl font-black text-ink">Registrar dia</h2>
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
          <Input label="Data" type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} />
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Tipo</span>
            <select
              className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
              value={workType}
              onChange={(event) => setWorkType(event.target.value as WorkType)}
            >
              {(Object.keys(workTypeLabels) as WorkType[]).map((type) => (
                <option key={type} value={type}>
                  {workTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-md border border-line bg-[#FCFAF6] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Valor previsto</p>
            <p className="mt-2 text-2xl font-black text-ink">{formatCurrency(preview)}</p>
          </div>
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
            <Button type="submit" isLoading={submitting} disabled={!employee}>
              <Check size={18} />
              Registrar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
