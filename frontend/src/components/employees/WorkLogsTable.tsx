"use client";

import { CheckCircle2, Rows3 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { Employee, WorkLog, WorkPaymentMode } from "./types";

type Props = {
  employees: Employee[];
  workLogs: WorkLog[];
  loading: boolean;
  payingId: number | null;
  selectedEmployee: Employee | null;
  onPay: (workLog: WorkLog) => void;
  onClearFilter: () => void;
};

const paymentModeLabels: Record<WorkPaymentMode, string> = {
  full_day: "Diaria cheia",
  proportional_hours: "Proporcional"
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatTime(value: string | null) {
  if (!value) return "-";
  return value.slice(0, 5);
}

export function WorkLogsTable({ employees, workLogs, loading, payingId, selectedEmployee, onPay, onClearFilter }: Props) {
  const employeeById = new Map(employees.map((employee) => [employee.id, employee.name]));

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-white/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Registros</p>
            <h2 className="mt-1 text-2xl font-black text-ink">
              {selectedEmployee ? `Registros de ${selectedEmployee.name}` : "Ponto diario"}
            </h2>
          </div>
          {selectedEmployee ? (
            <Button type="button" variant="secondary" onClick={onClearFilter}>
              Ver todos
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
            ))}
          </div>
        ) : workLogs.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Rows3 size={20} />}
              title="Nenhum registro encontrado"
              description="Registre entrada, saida e intervalo para calcular diaria e horas extras."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1380px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-[#FCFAF6] text-xs font-black uppercase tracking-[0.12em] text-muted">
                  {[
                    "Funcionario",
                    "Data",
                    "Entrada",
                    "Saida",
                    "Modo",
                    "Liquidas",
                    "Normais",
                    "Extras",
                    "Base",
                    "Extra R$",
                    "Total",
                    "Status",
                    "Acoes"
                  ].map((heading) => (
                    <th key={heading} className="border-b border-line px-4 py-3">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workLogs.map((workLog) => (
                  <tr key={workLog.id} className="transition hover:bg-accent-soft/28">
                    <td className="border-b border-line/70 px-4 py-4 font-bold text-ink">
                      {employeeById.get(workLog.employee_id) ?? `#${workLog.employee_id}`}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">{formatDate(workLog.work_date)}</td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">{formatTime(workLog.clock_in)}</td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">{formatTime(workLog.clock_out)}</td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">
                      {paymentModeLabels[workLog.payment_mode]}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 font-bold text-ink">{workLog.net_hours}h</td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">{workLog.regular_hours}h</td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">{workLog.overtime_hours}h</td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">
                      {formatCurrency(workLog.base_amount)}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">
                      {formatCurrency(workLog.overtime_amount)}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 font-black text-ink">
                      {formatCurrency(workLog.total_amount)}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4">
                      <Badge tone={workLog.payment_status === "paid" ? "success" : "warning"}>
                        {workLog.payment_status === "paid" ? "Pago" : "Aberto"}
                      </Badge>
                    </td>
                    <td className="border-b border-line/70 px-4 py-4">
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-9 px-3"
                        disabled={workLog.payment_status === "paid" || workLog.weekly_closing_id !== null}
                        isLoading={payingId === workLog.id}
                        onClick={() => onPay(workLog)}
                        title={
                          workLog.weekly_closing_id !== null
                            ? "Registro vinculado a fechamento semanal"
                            : undefined
                        }
                      >
                        <CheckCircle2 size={15} />
                        Marcar pago
                      </Button>
                      {workLog.paid_at ? (
                        <p className="mt-2 text-xs font-semibold text-muted">{formatDateTime(workLog.paid_at)}</p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
