import { Banknote, CircleDollarSign, HandCoins, TrendingUp, WalletCards } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import type { FinanceSummary } from "@/components/finance/types";
import { formatCurrency } from "@/lib/format";

type Props = {
  summary: FinanceSummary;
};

export function FinanceSummaryCards({ summary }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <StatCard
        label="Faturado"
        value={formatCurrency(summary.totalInvoiced)}
        detail="Valor total das OS carregadas."
        icon={<CircleDollarSign size={20} />}
      />
      <StatCard
        label="Recebido"
        value={formatCurrency(summary.totalReceived)}
        detail="Pagamentos registrados nas OS."
        icon={<WalletCards size={20} />}
      />
      <StatCard
        label="A receber"
        value={formatCurrency(summary.totalPending)}
        detail="Saldo pendente de clientes."
        icon={<Banknote size={20} />}
      />
      <StatCard
        label="Repasses pendentes"
        value={formatCurrency(summary.payoutPending)}
        detail="Terceirização ainda não paga."
        icon={<HandCoins size={20} />}
      />
      <StatCard
        label="Lucro terceirização"
        value={formatCurrency(summary.outsourcingProfit)}
        detail="Diferenca entre cliente e repasse."
        icon={<TrendingUp size={20} />}
      />
    </div>
  );
}
