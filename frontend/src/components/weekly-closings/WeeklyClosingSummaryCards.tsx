import { CalendarCheck2, CalendarClock, ClipboardCheck, TrendingUp } from "lucide-react";
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
  const gross = closings.reduce((total, closing) => total + money(closing.gross_result), 0);
  const latest = [...closings].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Fechamentos criados"
        value={closings.length}
        detail="Periodos consolidados no sistema."
        icon={<CalendarClock size={20} />}
      />
      <StatCard
        label="Fechamentos fechados"
        value={closed}
        detail="Semanas bloqueadas para alteracoes."
        icon={<ClipboardCheck size={20} />}
      />
      <StatCard
        label="Ultimo fechamento"
        value={period(latest)}
        detail="Fechamento criado mais recentemente."
        icon={<CalendarCheck2 size={20} />}
      />
      <StatCard
        label="Resultado bruto acumulado"
        value={formatCurrency(gross)}
        detail="Recebido mais lucro, menos repasses pagos."
        icon={<TrendingUp size={20} />}
      />
    </div>
  );
}
