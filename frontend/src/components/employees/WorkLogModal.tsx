"use client";

import { Check, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
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

function hoursBetween(start: string, end: string) {
  if (!start || !end) return 0;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  if (!Number.isFinite(startTotal) || !Number.isFinite(endTotal) || endTotal <= startTotal) return 0;
  return (endTotal - startTotal) / 60;
}

function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

export function WorkLogModal({ employee, onClose, onCreated }: Props) {
  const [workDate, setWorkDate] = useState(today());
  const [clockIn, setClockIn] = useState("07:00");
  const [clockOut, setClockOut] = useState("16:00");
  const [breakHours, setBreakHours] = useState("1");
  const [paymentMode, setPaymentMode] = useState<WorkPaymentMode>("full_day");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (employee) {
      setWorkDate(today());
      setClockIn("07:00");
      setClockOut("16:00");
      setBreakHours(employee.standard_lunch_hours);
      setPaymentMode("full_day");
      setNotes("");
      setError(null);
    }
  }, [employee]);

  const preview = useMemo(() => {
    if (!employee) {
      return {
        grossHours: 0,
        netHours: 0,
        regularHours: 0,
        overtimeHours: 0,
        hourlyRate: 0,
        baseAmount: 0,
        overtimeAmount: 0,
        totalAmount: 0
      };
    }

    const grossHours = roundHours(hoursBetween(clockIn, clockOut));
    const interval = Number(breakHours);
    const safeInterval = Number.isFinite(interval) && interval >= 0 ? interval : 0;
    const netHours = roundHours(Math.max(grossHours - safeInterval, 0));
    const standardHours = Number(employee.standard_daily_hours);
    const dailyRate = Number(employee.daily_rate);
    const hourlyRate = standardHours > 0 ? dailyRate / standardHours : 0;
    const regularHours = roundHours(Math.min(netHours, standardHours));
    const overtimeHours = roundHours(Math.max(netHours - standardHours, 0));
    const baseAmount = paymentMode === "full_day" ? (netHours > 0 ? dailyRate : 0) : regularHours * hourlyRate;
    const overtimeAmount = overtimeHours * hourlyRate;

    return {
      grossHours,
      netHours,
      regularHours,
      overtimeHours,
      hourlyRate,
      baseAmount,
      overtimeAmount,
      totalAmount: baseAmount + overtimeAmount
    };
  }, [breakHours, clockIn, clockOut, employee, paymentMode]);

  if (!employee) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employee) {
      setError("Selecione um funcionario antes de registrar o dia.");
      return;
    }
    if (!workDate || !clockIn || !clockOut) {
      setError("Informe data, entrada e saida.");
      return;
    }
    if (preview.grossHours <= 0) {
      setError("A hora de saida deve ser maior que a hora de entrada.");
      return;
    }
    if (Number(breakHours) > preview.grossHours) {
      setError("O intervalo nao pode ser maior que as horas brutas.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const workLog = await api.post<WorkLog>(`/employees/${employee.id}/work-logs`, {
        work_date: workDate,
        clock_in: clockIn,
        clock_out: clockOut,
        break_hours: breakHours,
        payment_mode: paymentMode,
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
      <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-lg border border-line bg-white shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
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
        <form className="max-h-[calc(92vh-76px)] space-y-4 overflow-y-auto p-5" onSubmit={submit}>
          {error ? (
            <div className="rounded-md border border-danger/20 bg-danger/10 p-3 text-sm font-semibold text-danger">
              {error}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-4">
            <Input label="Data" type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} />
            <Input label="Entrada" type="time" value={clockIn} onChange={(event) => setClockIn(event.target.value)} />
            <Input label="Saida" type="time" value={clockOut} onChange={(event) => setClockOut(event.target.value)} />
            <Input
              label="Intervalo"
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
          <div className="grid gap-3 md:grid-cols-4">
            <PreviewTile label="Brutas" value={`${preview.grossHours}h`} />
            <PreviewTile label="Liquidas" value={`${preview.netHours}h`} />
            <PreviewTile label="Normais" value={`${preview.regularHours}h`} />
            <PreviewTile label="Extras" value={`${preview.overtimeHours}h`} />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <PreviewTile label="Valor hora" value={formatCurrency(preview.hourlyRate)} />
            <PreviewTile label="Base do dia" value={formatCurrency(preview.baseAmount)} />
            <PreviewTile label="Horas extras" value={formatCurrency(preview.overtimeAmount)} />
            <PreviewTile label="Total do dia" value={formatCurrency(preview.totalAmount)} strong />
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

function PreviewTile({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-md border border-line bg-[#FCFAF6] p-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className={strong ? "mt-2 text-xl font-black text-ink" : "mt-2 text-lg font-black text-ink"}>{value}</p>
    </div>
  );
}
