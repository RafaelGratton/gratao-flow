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
  const pendingValue = pendingLogs.reduce((total, log) => total + Number(log.amount), 0);
  const paidLogs = workLogs.filter((log) => log.payment_status === "paid").length;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Funcionários ativos"
        value={activeEmployees}
        detail="Pessoas disponiveis para apontamento."
        icon={<Users size={20} />}
      />
      <StatCard
        label="Diarias pendentes"
        value={pendingLogs.length}
        detail="Registros aguardando pagamento."
        icon={<CalendarClock size={20} />}
      />
      <StatCard
        label="Valor pendente"
        value={formatCurrency(pendingValue)}
        detail="Total aberto em diarias."
        icon={<Banknote size={20} />}
      />
      <StatCard
        label="Registros pagos"
        value={paidLogs}
        detail="Diarias ja baixadas no controle."
        icon={<CheckCircle2 size={20} />}
      />
    </div>
  );
}
