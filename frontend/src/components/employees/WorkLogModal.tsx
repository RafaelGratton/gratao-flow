"use client";

import { LogIn, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import type { Employee, WorkLog, WorkPaymentMode } from "./types";

type Props = {
  employee: Employee | null;
  onClose: () => void;
  onCreated: (workLog: WorkLog) => void;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

const paymentModeLabels: Record<WorkPaymentMode, string> = {
  full_day: "Diaria cheia",
  proportional_hours: "Proporcional por horas"
};

export function WorkLogModal({ employee, onClose, onCreated }: Props) {
  const [workDate, setWorkDate] = useState(today());
  const [clockIn, setClockIn] = useState("07:00");
  const [breakHours, setBreakHours] = useState("1");
  const [paymentMode, setPaymentMode] = useState<WorkPaymentMode>("full_day");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (employee) {
      setWorkDate(today());
      setClockIn("07:00");
      setBreakHours(employee.standard_lunch_hours);
      setPaymentMode("full_day");
      setNotes("");
      setError(null);
    }
  }, [employee]);

  if (!employee) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employee) {
      setError("Selecione um funcionario antes de registrar a entrada.");
      return;
    }
    if (!workDate || !clockIn) {
      setError("Informe data e hora de entrada.");
      return;
    }
    if (Number(breakHours) < 0 || Number.isNaN(Number(breakHours))) {
      setError("O intervalo deve ser maior ou igual a zero.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const workLog = await api.post<WorkLog>(`/employees/${employee.id}/work-logs`, {
        work_date: workDate,
        clock_in: clockIn,
        break_hours: breakHours,
        payment_mode: paymentMode,
        notes: notes.trim() || null
      });
      onCreated(workLog);
      onClose();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Nao foi possivel registrar a entrada.";
      setError(message.includes("already has") ? "Ja existe registro para este funcionario nessa data." : message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-nav/45 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-lg border border-line bg-white shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">{employee.name}</p>
            <h2 className="mt-1 text-xl font-black text-ink">Registrar entrada</h2>
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
          <div className="grid gap-4 md:grid-cols-3">
            <Input label="Data" type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} />
            <Input label="Entrada" type="time" value={clockIn} onChange={(event) => setClockIn(event.target.value)} />
            <Input
              label="Intervalo previsto"
              type="number"
              min="0"
              step="0.25"
              value={breakHours}
              onChange={(event) => setBreakHours(event.target.value)}
            />
          </div>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Modo de pagamento</span>
            <select
              className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
              value={paymentMode}
              onChange={(event) => setPaymentMode(event.target.value as WorkPaymentMode)}
            >
              {(Object.keys(paymentModeLabels) as WorkPaymentMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {paymentModeLabels[mode]}
                </option>
              ))}
            </select>
          </label>
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
            <Button type="submit" isLoading={submitting}>
              <LogIn size={18} />
              Registrar entrada
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
