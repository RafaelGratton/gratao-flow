export type WeeklyClosingStatus = "open" | "closed" | "paid";

export type WeeklyClosing = {
  id: number;
  employee_id: number | null;
  start_date: string;
  end_date: string;
  days_worked: number;
  total_gross_hours: string;
  total_break_hours: string;
  total_net_hours: string;
  total_regular_hours: string;
  total_overtime_hours: string;
  total_base_amount: string;
  total_overtime_amount: string;
  discounts: string;
  advances: string;
  total_payable: string;
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
  paid_at: string | null;
  notes: string | null;
  created_at: string;
};

export type WeeklyClosingCreate = {
  employee_id: number;
  start_date: string;
  end_date: string;
  discounts: string;
  advances: string;
  notes: string | null;
};
