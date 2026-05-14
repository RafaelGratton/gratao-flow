export type WorkType = "full_day" | "half_day" | "absence";
export type WorkPaymentMode = "full_day" | "proportional_hours";
export type EmployeePaymentStatus = "pending" | "paid";

export type Employee = {
  id: number;
  name: string;
  role: string | null;
  phone: string | null;
  daily_rate: string;
  standard_daily_hours: string;
  standard_lunch_hours: string;
  hourly_rate: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};

export type WorkLog = {
  id: number;
  employee_id: number;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_hours: string;
  gross_hours: string;
  net_hours: string;
  regular_hours: string;
  overtime_hours: string;
  payment_mode: WorkPaymentMode;
  work_type: WorkType;
  base_amount: string;
  overtime_amount: string;
  total_amount: string;
  amount: string;
  weekly_closing_id: number | null;
  payment_status: EmployeePaymentStatus;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
};
