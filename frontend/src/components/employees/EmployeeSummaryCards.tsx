import { Banknote, CalendarClock, CheckCircle2, Users } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatCurrency } from "@/lib/format";
import type { Employee, WorkLog } from "./types";

type Props = {
  employees: Employee[];
  workLogs: WorkLog[];
};

export function EmployeeSummaryCards({ employees, workLogs }: Props) {
  const activeEmployees = employees.filter((employee) => employee.is_active).length;
  const pendingLogs = workLogs.filter((log) => log.payment_status === "pending");
  const pendingValue = pendingLogs.reduce((total, log) => total + Number(log.total_amount), 0);
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
        value={pendingLogs.length}
        detail="Dias ainda sem pagamento individual."
        icon={<CalendarClock size={20} />}
      />
      <StatCard
        label="Valor pendente"
        value={formatCurrency(pendingValue)}
        detail="Total aberto em ponto diario."
        icon={<Banknote size={20} />}
      />
      <StatCard
        label="Horas extras"
        value={`${overtimeHours.toFixed(2)}h`}
        detail="Horas extras nos registros carregados."
        icon={<CheckCircle2 size={20} />}
      />
    </div>
  );
}
