import { Banknote, CalendarClock, CheckCircle2, Users } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatCurrency, formatHoursDuration } from "@/lib/format";
import type { Employee, WorkLog } from "./types";

type Props = {
  employees: Employee[];
  workLogs: WorkLog[];
};

export function EmployeeSummaryCards({ employees, workLogs }: Props) {
  const activeEmployees = employees.filter((employee) => employee.is_active).length;
  const openLogs = workLogs.filter((log) => log.work_status === "open");
  const pendingPaymentLogs = workLogs.filter(
    (log) => log.work_status === "completed" && log.payment_status === "pending" && log.weekly_closing_id === null
  );
  const pendingValue = pendingPaymentLogs.reduce((total, log) => total + Number(log.total_amount), 0);
  const overtimeHours = workLogs.reduce((total, log) => total + Number(log.overtime_hours), 0);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Funcionários ativos"
        value={activeEmployees}
        detail="Pessoas disponiveis para apontamento."
        icon={<Users size={20} />}
      />
      <StatCard
        label="Registros abertos"
        value={openLogs.length}
        detail="Entradas ainda sem hora de saida."
        icon={<CalendarClock size={20} />}
      />
      <StatCard
        label="Valor pendente"
        value={formatCurrency(pendingValue)}
        detail="Dias concluidos aguardando fechamento."
        icon={<Banknote size={20} />}
      />
      <StatCard
        label="Horas extras"
        value={formatHoursDuration(overtimeHours)}
        detail="Horas extras nos registros carregados."
        icon={<CheckCircle2 size={20} />}
      />
    </div>
  );
}
