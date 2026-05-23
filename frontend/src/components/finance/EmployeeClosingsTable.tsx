"use client";

import { CheckCircle2, Eye, UsersRound } from "lucide-react";
import type { Employee } from "@/components/employees/types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { WeeklyClosing, WeeklyClosingStatus } from "@/components/weekly-closings/types";
import { formatCurrency, formatDateTime } from "@/lib/format";

type Props = {
  closings: WeeklyClosing[];
  employees: Employee[];
  loading: boolean;
  payingId: number | null;
  onDetail: (closing: WeeklyClosing) => void;
  onPay: (closing: WeeklyClosing) => void;
};

const statusLabels: Record<WeeklyClosingStatus, string> = {
  open: "Aberto",
  closed: "Fechado",
  paid: "Pago"
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export function EmployeeClosingsTable({ closings, employees, loading, payingId, onDetail, onPay }: Props) {
  const employeeById = new Map(employees.map((employee) => [employee.id, employee.name]));

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-white/70">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Funcionarios</p>
          <h2 className="mt-1 text-xl font-black text-ink">Fechamentos semanais no periodo</h2>
          <p className="mt-2 text-sm text-muted">
            Pagos entram pela data de pagamento; pendentes entram pelo fim do fechamento.
          </p>
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
              icon={<UsersRound size={20} />}
              title="Nenhum fechamento no periodo"
              description="Os pagamentos e valores a pagar de funcionarios aparecem aqui."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1060px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-[#FCFAF6] text-xs font-black uppercase tracking-[0.12em] text-muted">
                  {["Funcionario", "Periodo", "Total a pagar", "Status", "Pago em", "Acoes"].map((heading) => (
                    <th key={heading} className="border-b border-line px-4 py-3">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {closings.map((closing) => {
                  const pending = closing.status !== "paid";
                  const employeeName = closing.employee_id
                    ? employeeById.get(closing.employee_id) ?? `#${closing.employee_id}`
                    : "Geral";
                  return (
                    <tr key={closing.id} className={pending ? "bg-warning/5" : "transition hover:bg-accent-soft/20"}>
                      <td className="border-b border-line/70 px-4 py-4 font-bold text-ink">{employeeName}</td>
                      <td className="border-b border-line/70 px-4 py-4 text-muted">
                        {formatDate(closing.start_date)} a {formatDate(closing.end_date)}
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
                      <td className="border-b border-line/70 px-4 py-4 text-muted">
                        {closing.paid_at ? formatDateTime(closing.paid_at) : "-"}
                      </td>
                      <td className="border-b border-line/70 px-4 py-4">
                        <div className="flex gap-2">
                          <Button type="button" variant="secondary" className="h-10 px-3" onClick={() => onDetail(closing)}>
                            <Eye size={16} />
                            Ver detalhes
                          </Button>
                          {pending ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-10 px-3"
                              isLoading={payingId === closing.id}
                              onClick={() => onPay(closing)}
                            >
                              <CheckCircle2 size={16} />
                              Pagar
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
