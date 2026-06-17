"use client";

import { CalendarCheck2, CalendarPlus, Pencil, Plus, Rows3, UserRoundPlus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatHoursDuration } from "@/lib/format";
import type { Employee } from "./types";

type Props = {
  employees: Employee[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (employee: Employee) => void;
  onRegisterDay: (employee: Employee) => void;
  onCloseWeek: (employee: Employee) => void;
  onViewLogs: (employee: Employee) => void;
};

export function EmployeeTable({ employees, loading, onCreate, onEdit, onRegisterDay, onCloseWeek, onViewLogs }: Props) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-white/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Equipe</p>
            <h2 className="mt-1 text-2xl font-black text-ink">Funcionarios</h2>
          </div>
          <Button type="button" onClick={onCreate}>
            <Plus size={18} />
            Novo funcionario
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
            ))}
          </div>
        ) : employees.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<UserRoundPlus size={20} />}
              title="Nenhum funcionario cadastrado"
              description="Cadastre a equipe para registrar ponto diario e fechamento semanal."
            >
              <Button type="button" className="mt-5" onClick={onCreate}>
                <Plus size={18} />
                Novo funcionario
              </Button>
            </EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1240px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-[#FCFAF6] text-xs font-black uppercase tracking-[0.12em] text-muted">
                  {["Nome", "Funcao", "Diaria", "Jornada", "Almoco", "Hora", "Pix", "Status", "Acoes"].map((heading) => (
                    <th key={heading} className="border-b border-line px-4 py-3">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id} className="transition hover:bg-accent-soft/28">
                    <td className="border-b border-line/70 px-4 py-4 font-bold text-ink">{employee.name}</td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">{employee.role || "-"}</td>
                    <td className="border-b border-line/70 px-4 py-4 font-bold text-ink">
                      {formatCurrency(employee.daily_rate)}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">
                      {formatHoursDuration(employee.standard_daily_hours)}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">
                      {formatHoursDuration(employee.standard_lunch_hours)}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 font-bold text-ink">
                      {formatCurrency(employee.hourly_rate)}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4">
                      <Badge tone={employee.pix_key ? "success" : "warning"}>
                        {employee.pix_key ? "Cadastrado" : "Pendente"}
                      </Badge>
                    </td>
                    <td className="border-b border-line/70 px-4 py-4">
                      <Badge tone={employee.is_active ? "success" : "neutral"}>
                        {employee.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="border-b border-line/70 px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => onEdit(employee)}>
                          <Pencil size={15} />
                          Editar
                        </Button>
                        <Button type="button" variant="secondary" className="h-9 px-3" onClick={() => onRegisterDay(employee)}>
                          <CalendarPlus size={15} />
                          Entrada
                        </Button>
                        <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => onCloseWeek(employee)}>
                          <CalendarCheck2 size={15} />
                          Fechar semana
                        </Button>
                        <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => onViewLogs(employee)}>
                          <Rows3 size={15} />
                          Ver registros
                        </Button>
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
