import { Banknote, CircleDollarSign, HandCoins, TrendingDown, TrendingUp, UsersRound, WalletCards } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import type { FinanceSummary } from "@/components/finance/types";
import { formatCurrency } from "@/lib/format";

type Props = {
  summary: FinanceSummary;
};

export function FinanceSummaryCards({ summary }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <StatCard
        label="Faturado no periodo"
        value={formatCurrency(summary.totalInvoiced)}
        detail="OS criadas no intervalo selecionado."
        icon={<CircleDollarSign size={20} />}
      />
      <StatCard
        label="Recebido no periodo"
        value={formatCurrency(summary.totalReceived)}
        detail="Pagamentos de clientes realizados no intervalo."
        icon={<WalletCards size={20} />}
      />
      <StatCard
        label="A receber"
        value={formatCurrency(summary.totalPending)}
        detail="Saldo atual das OS faturadas no periodo."
        icon={<Banknote size={20} />}
      />
      <StatCard
        label="Funcionarios pagos"
        value={formatCurrency(summary.employeePaid)}
        detail="Fechamentos pagos no intervalo."
        icon={<UsersRound size={20} />}
      />
      <StatCard
        label="Funcionarios a pagar"
        value={formatCurrency(summary.employeePending)}
        detail="Fechamentos pendentes no periodo."
        icon={<UsersRound size={20} />}
      />
      <StatCard
        label="Terceirizacao paga"
        value={formatCurrency(summary.payoutPaid)}
        detail="Repasses pagos no intervalo."
        icon={<HandCoins size={20} />}
      />
      <StatCard
        label="Terceirizacao a pagar"
        value={formatCurrency(summary.payoutPending)}
        detail="Repasses pendentes enviados no periodo."
        icon={<HandCoins size={20} />}
      />
      <StatCard
        label="Resultado de caixa"
        value={formatCurrency(summary.cashResult)}
        detail="Recebido menos funcionarios e terceirizacao pagos."
        icon={<TrendingDown size={20} />}
      />
      <StatCard
        label="Resultado projetado"
        value={formatCurrency(summary.projectedResult)}
        detail="Faturado menos valores pendentes de pagamento."
        icon={<TrendingUp size={20} />}
      />
    </div>
  );
}
