"use client";

import { Pencil, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { formatCurrency, formatHoursDuration } from "@/lib/format";
import { formatTime24, isValidTime24, Time24Input } from "./Time24Input";
import type { Employee, WorkLog, WorkPaymentMode } from "./types";

type Props = {
  workLog: WorkLog | null;
  employee: Employee | null;
  onClose: () => void;
  onSaved: (workLog: WorkLog) => void;
};

const paymentModeLabels: Record<WorkPaymentMode, string> = {
  full_day: "Diaria cheia",
  proportional_hours: "Proporcional por horas"
};

function hoursBetween(start: string, end: string) {
  const [startHour, startMinute] = start.slice(0, 5).split(":").map(Number);
  const [endHour, endMinute] = end.slice(0, 5).split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  if (!Number.isFinite(startTotal) || !Number.isFinite(endTotal) || endTotal <= startTotal) return 0;
  return (endTotal - startTotal) / 60;
}

function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

function decimalInput(value: string | number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

export function WorkLogCorrectionModal({ workLog, employee, onClose, onSaved }: Props) {
  const [workDate, setWorkDate] = useState("");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [breakHours, setBreakHours] = useState("0");
  const [paymentMode, setPaymentMode] = useState<WorkPaymentMode>("full_day");
  const [totalAmount, setTotalAmount] = useState("0.00");
  const [totalTouched, setTotalTouched] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (workLog) {
      setWorkDate(workLog.work_date);
      setClockIn(formatTime24(workLog.clock_in));
      setClockOut(workLog.clock_out ? formatTime24(workLog.clock_out) : "");
      setBreakHours(workLog.break_hours);
      setPaymentMode(workLog.payment_mode);
      setTotalAmount(workLog.total_amount);
      setTotalTouched(false);
      setNotes(workLog.notes ?? "");
      setError(null);
    }
  }, [workLog]);

  const preview = useMemo(() => {
    if (!employee || !clockIn || !clockOut || !isValidTime24(clockIn) || !isValidTime24(clockOut)) {
      return {
        grossHours: 0,
        netHours: 0,
        regularHours: 0,
        overtimeHours: 0,
        baseAmount: 0,
        overtimeAmount: 0,
        calculatedTotal: 0
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
      baseAmount,
      overtimeAmount,
      calculatedTotal: baseAmount + overtimeAmount
    };
  }, [breakHours, clockIn, clockOut, employee, paymentMode]);

  if (!workLog || !employee) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentWorkLog = workLog;
    if (!currentWorkLog) return;
    if (!workDate || !clockIn) {
      setError("Informe data e hora de entrada.");
      return;
    }
    if (!isValidTime24(clockIn)) {
      setError("Informe a entrada no formato 24h HH:mm, por exemplo 07:00.");
      return;
    }
    if (clockOut && !isValidTime24(clockOut)) {
      setError("Informe a saida no formato 24h HH:mm, por exemplo 16:00.");
      return;
    }
    if (clockOut && preview.grossHours <= 0) {
      setError("A hora de saida deve ser maior que a hora de entrada.");
      return;
    }
    if (Number(breakHours) < 0 || Number.isNaN(Number(breakHours))) {
      setError("O intervalo deve ser maior ou igual a zero.");
      return;
    }
    if (clockOut && Number(breakHours) > preview.grossHours) {
      setError("O intervalo nao pode ser maior que as horas brutas.");
      return;
    }
    if (Number(totalAmount) < 0 || Number.isNaN(Number(totalAmount))) {
      setError("O valor total deve ser maior ou igual a zero.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const saved = await api.patch<WorkLog>(`/work-logs/${currentWorkLog.id}`, {
        work_date: workDate,
        clock_in: clockIn,
        clock_out: clockOut || null,
        break_hours: breakHours,
        payment_mode: paymentMode,
        total_amount: totalTouched ? decimalInput(totalAmount) : undefined,
        notes: notes.trim() || null
      });
      onSaved(saved);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel corrigir o ponto.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-nav/45 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-lg border border-line bg-white shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">{employee.name}</p>
            <h2 className="mt-1 text-xl font-black text-ink">Corrigir ponto</h2>
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
            <Time24Input label="Entrada" value={clockIn} onChange={setClockIn} />
            <Time24Input label="Saida" value={clockOut} onChange={setClockOut} />
            <Input
              label="Intervalo"
              type="number"
              min="0"
              step="0.25"
              value={breakHours}
              onChange={(event) => setBreakHours(event.target.value)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
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
            <Input
              label="Valor total"
              type="number"
              min="0"
              step="0.01"
              value={totalAmount}
              onChange={(event) => {
                setTotalAmount(event.target.value);
                setTotalTouched(true);
              }}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <PreviewTile label="Liquidas" value={formatHoursDuration(preview.netHours)} />
            <PreviewTile label="Extras" value={formatHoursDuration(preview.overtimeHours)} />
            <PreviewTile label="Base calculada" value={formatCurrency(preview.baseAmount)} />
            <PreviewTile label="Total calculado" value={formatCurrency(preview.calculatedTotal)} />
            <PreviewTile label="Total salvo" value={formatCurrency(totalAmount)} strong />
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
            <Button type="submit" isLoading={submitting}>
              <Pencil size={18} />
              Salvar correcao
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
