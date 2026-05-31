import type { OrderDetails } from "@/components/orders/types";

export type FinancePeriodPreset = "this_month" | "previous_month" | "this_week" | "today" | "custom";

export type FinanceTab = "summary" | "receivables" | "employees" | "outsourcing";

export type PayoutRow = {
  order: OrderDetails;
  outsourcing: OrderDetails["outsourcings"][number];
};

export type FinanceSummary = {
  totalInvoiced: number;
  totalReceived: number;
  totalPending: number;
  employeePaid: number;
  employeePending: number;
  payoutPaid: number;
  payoutPending: number;
  outsourcingCostTotal: number;
  cashResult: number;
  projectedResult: number;
};
