import type { OrderDetails } from "@/components/orders/types";

export type PayoutRow = {
  order: OrderDetails;
  outsourcing: OrderDetails["outsourcings"][number];
};

export type FinanceSummary = {
  totalInvoiced: number;
  totalReceived: number;
  totalPending: number;
  payoutPending: number;
  outsourcingProfit: number;
};
