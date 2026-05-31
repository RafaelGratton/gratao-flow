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
        label="Cobrado do cliente"
        value={formatCurrency(summary.totalInvoiced)}
        detail="Valor de venda das OS no periodo."
        icon={<CircleDollarSign size={20} />}
      />
      <StatCard
        label="Recebido de clientes"
        value={formatCurrency(summary.totalReceived)}
        detail="Pagamentos de clientes realizados no intervalo."
        icon={<WalletCards size={20} />}
      />
      <StatCard
        label="Saldo a receber"
        value={formatCurrency(summary.totalPending)}
        detail="Pendente das OS faturadas no periodo."
        icon={<Banknote size={20} />}
      />
      <StatCard
        label="Custo terceirizado"
        value={formatCurrency(summary.outsourcingCostTotal)}
        detail="Repasses pagos e pendentes vinculados as OS."
        icon={<HandCoins size={20} />}
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
        label="Resultado estimado"
        value={formatCurrency(summary.projectedResult)}
        detail="Cobrado do cliente menos custos conhecidos."
        icon={<TrendingUp size={20} />}
      />
    </div>
  );
}
