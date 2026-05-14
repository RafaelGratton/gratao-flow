import { Banknote, CalendarCheck2, CalendarClock, ClipboardCheck } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import type { WeeklyClosing } from "@/components/weekly-closings/types";
import { formatCurrency } from "@/lib/format";

type Props = {
  closings: WeeklyClosing[];
};

function money(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function period(closing?: WeeklyClosing) {
  if (!closing) return "Nenhum";
  return `${closing.start_date} a ${closing.end_date}`;
}

export function WeeklyClosingSummaryCards({ closings }: Props) {
  const closed = closings.filter((closing) => closing.status === "closed").length;
  const paid = closings.filter((closing) => closing.status === "paid").length;
  const payable = closings.reduce((total, closing) => total + money(closing.total_payable), 0);
  const latest = [...closings].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Fechamentos criados"
        value={closings.length}
        detail="Semanas individuais no sistema."
        icon={<CalendarClock size={20} />}
      />
      <StatCard
        label="Fechados"
        value={closed}
        detail="Conferidos e aguardando pagamento."
        icon={<ClipboardCheck size={20} />}
      />
      <StatCard
        label="Pagos"
        value={paid}
        detail="Fechamentos ja quitados."
        icon={<CalendarCheck2 size={20} />}
      />
      <StatCard
        label="Total a pagar"
        value={formatCurrency(payable)}
        detail={`Ultimo: ${period(latest)}`}
        icon={<Banknote size={20} />}
      />
    </div>
  );
}
