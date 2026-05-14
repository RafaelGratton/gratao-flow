"use client";

import { CheckCircle2, Eye, LockKeyhole, Plus } from "lucide-react";
import type { Employee } from "@/components/employees/types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { WeeklyClosing, WeeklyClosingStatus } from "@/components/weekly-closings/types";
import { formatCurrency } from "@/lib/format";

type Props = {
  closings: WeeklyClosing[];
  employees: Employee[];
  loading: boolean;
  changingId: number | null;
  onCreate: () => void;
  onDetail: (closing: WeeklyClosing) => void;
  onCloseWeek: (closing: WeeklyClosing) => void;
  onPayWeek: (closing: WeeklyClosing) => void;
};

const statusLabels: Record<WeeklyClosingStatus, string> = {
  open: "Aberto",
  closed: "Fechado",
  paid: "Pago"
};

export function WeeklyClosingsTable({
  closings,
  employees,
  loading,
  changingId,
  onCreate,
  onDetail,
  onCloseWeek,
  onPayWeek
}: Props) {
  const employeeById = new Map(employees.map((employee) => [employee.id, employee.name]));

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-white/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Fechamentos</p>
            <h2 className="mt-1 text-xl font-black text-ink">Semanas por funcionario</h2>
          </div>
          <Button type="button" onClick={onCreate}>
            <Plus size={18} />
            Novo fechamento
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
            ))}
          </div>
        ) : closings.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<LockKeyhole size={20} />}
              title="Nenhum fechamento criado"
              description="Crie um periodo individual para consolidar ponto, extras e valor a pagar."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-[#FCFAF6] text-xs font-black uppercase tracking-[0.12em] text-muted">
                  {[
                    "Semana",
                    "Funcionario",
                    "Dias",
                    "Liquidas",
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
                {closings.map((closing) => (
                  <tr key={closing.id} className="transition hover:bg-accent-soft/20">
                    <td className="border-b border-line/70 px-4 py-4 font-black text-ink">
                      {closing.start_date} a {closing.end_date}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 font-bold text-ink">
                      {closing.employee_id ? employeeById.get(closing.employee_id) ?? `#${closing.employee_id}` : "Geral"}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">{closing.days_worked}</td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">{closing.total_net_hours}h</td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">{closing.total_overtime_hours}h</td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">
                      {formatCurrency(closing.total_base_amount)}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">
                      {formatCurrency(closing.total_overtime_amount)}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 font-black text-ink">
                      {formatCurrency(closing.total_payable)}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4">
                      <StatusBadge
                        label={statusLabels[closing.status]}
                        status={closing.status === "paid" ? "done" : closing.status === "closed" ? "warning" : "active"}
                      />
                    </td>
                    <td className="border-b border-line/70 px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="secondary" className="h-10 px-3" onClick={() => onDetail(closing)}>
                          <Eye size={16} />
                          Ver detalhe
                        </Button>
                        {closing.status === "open" ? (
                          <Button
                            type="button"
                            className="h-10 px-3"
                            isLoading={changingId === closing.id}
                            onClick={() => onCloseWeek(closing)}
                          >
                            <LockKeyhole size={16} />
                            Fechar
                          </Button>
                        ) : null}
                        {closing.status !== "paid" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-10 px-3"
                            isLoading={changingId === closing.id}
                            onClick={() => onPayWeek(closing)}
                          >
                            <CheckCircle2 size={16} />
                            Pagar
                          </Button>
                        ) : null}
                      </div>
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
