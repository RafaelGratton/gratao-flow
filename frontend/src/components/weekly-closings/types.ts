export type WeeklyClosingStatus = "open" | "closed";

export type WeeklyClosing = {
  id: number;
  start_date: string;
  end_date: string;
  total_orders: number;
  total_pieces_requested: number;
  total_pieces_cut: number;
  total_pieces_printed: number;
  total_pieces_sewn: number;
  total_invoiced: string;
  total_received: string;
  total_pending: string;
  total_outsourcing_customer: string;
  total_outsourcing_payout: string;
  total_outsourcing_profit: string;
  total_payout_paid: string;
  total_payout_pending: string;
  gross_result: string;
  status: WeeklyClosingStatus;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
};

export type WeeklyClosingCreate = {
  start_date: string;
  end_date: string;
  notes: string | null;
};
