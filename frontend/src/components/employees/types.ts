export type WorkType = "full_day" | "half_day" | "absence";
export type EmployeePaymentStatus = "pending" | "paid";

export type Employee = {
  id: number;
  name: string;
  phone: string | null;
  daily_rate: string;
  is_active: boolean;
  created_at: string;
};

export type WorkLog = {
  id: number;
  employee_id: number;
  work_date: string;
  work_type: WorkType;
  amount: string;
  payment_status: EmployeePaymentStatus;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
};
