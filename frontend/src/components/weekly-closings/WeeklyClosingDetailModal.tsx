"use client";

import { X } from "lucide-react";
import type { Employee } from "@/components/employees/types";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { WeeklyClosing, WeeklyClosingStatus } from "@/components/weekly-closings/types";
import { formatCurrency, formatDateTime } from "@/lib/format";

type Props = {
  closing: WeeklyClosing | null;
  employees: Employee[];
  onClose: () => void;
};

const statusLabels: Record<WeeklyClosingStatus, string> = {
  open: "Aberto",
  closed: "Fechado",
  paid: "Pago"
};

const hourFields: Array<[keyof WeeklyClosing, string]> = [
  ["total_gross_hours", "Horas brutas"],
  ["total_break_hours", "Intervalos"],
  ["total_net_hours", "Horas liquidas"],
  ["total_regular_hours", "Horas normais"],
  ["total_overtime_hours", "Horas extras"]
];

const moneyFields: Array<[keyof WeeklyClosing, string]> = [
  ["total_base_amount", "Total base"],
  ["total_overtime_amount", "Total horas extras"],
  ["discounts", "Descontos"],
  ["advances", "Adiantamentos"],
  ["total_payable", "Total a pagar"]
];

export function WeeklyClosingDetailModal({ closing, employees, onClose }: Props) {
  if (!closing) return null;

  const employeeName = closing.employee_id
    ? employees.find((employee) => employee.id === closing.employee_id)?.name ?? `#${closing.employee_id}`
    : "Geral";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-dark">
              {closing.start_date} a {closing.end_date}
            </p>
            <h2 className="mt-1 text-lg font-black text-ink">{employeeName}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-md text-muted transition hover:bg-[#FCFAF6] hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[calc(90vh-76px)] space-y-5 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge
              label={statusLabels[closing.status]}
              status={closing.status === "paid" ? "done" : closing.status === "closed" ? "warning" : "active"}
            />
            <span className="text-sm font-semibold text-muted">
              Fechado em: {closing.closed_at ? formatDateTime(closing.closed_at) : "Ainda aberto"}
            </span>
            <span className="text-sm font-semibold text-muted">
              Pago em: {closing.paid_at ? formatDateTime(closing.paid_at) : "Ainda nao pago"}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-line bg-[#FCFAF6] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Dias trabalhados</p>
              <p className="mt-2 text-2xl font-black text-ink">{closing.days_worked}</p>
            </div>
            {hourFields.map(([field, label]) => (
              <div key={field} className="rounded-md border border-line bg-[#FCFAF6] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
                <p className="mt-2 text-2xl font-black text-ink">{String(closing[field])}h</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {moneyFields.map(([field, label]) => (
              <div key={field} className="rounded-md border border-line bg-white p-4 shadow-insetline">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
                <p className="mt-2 text-lg font-black text-ink">{formatCurrency(String(closing[field]))}</p>
              </div>
            ))}
          </div>
          <div className="rounded-md border border-line bg-[#FCFAF6] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Notas</p>
            <p className="mt-2 text-sm leading-6 text-ink">{closing.notes || "Sem notas."}</p>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Fechar detalhe
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
