"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Employee } from "@/components/employees/types";
import { EmployeeClosingsTable } from "@/components/finance/EmployeeClosingsTable";
import { FinancePaymentModal } from "@/components/finance/FinancePaymentModal";
import { FinancePeriodFilter } from "@/components/finance/FinancePeriodFilter";
import { FinanceSummaryCards } from "@/components/finance/FinanceSummaryCards";
import { PayoutsTable } from "@/components/finance/PayoutsTable";
import { ReceivablesTable } from "@/components/finance/ReceivablesTable";
import type { FinancePeriodPreset, FinanceSummary, FinanceTab, PayoutRow } from "@/components/finance/types";
import type { OrderDetails, OrderSummary } from "@/components/orders/types";
import { Button } from "@/components/ui/Button";
import { WeeklyClosingDetailModal } from "@/components/weekly-closings/WeeklyClosingDetailModal";
import type { WeeklyClosing } from "@/components/weekly-closings/types";
import { api } from "@/lib/api";

type PeriodRange = {
  start: Date;
  end: Date;
};

const tabs: Array<[FinanceTab, string]> = [
  ["summary", "Resumo"],
  ["receivables", "Recebimentos"],
  ["employees", "Funcionarios"],
  ["outsourcing", "Terceirizacao"]
];

function money(value: string | number) {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : 0;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function endOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);
}

function dateInputValue(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

function inputDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function currentMonthRange() {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  };
}

function periodRange(preset: FinancePeriodPreset, customStart: string, customEnd: string): PeriodRange {
  const now = new Date();
  if (preset === "today") {
    return { start: startOfDay(now), end: endOfDay(now) };
  }
  if (preset === "this_week") {
    const mondayOffset = (now.getDay() + 6) % 7;
    const monday = startOfDay(now);
    monday.setDate(monday.getDate() - mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    return { start: monday, end: endOfDay(sunday) };
  }
  if (preset === "previous_month") {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0))
    };
  }
  if (preset === "custom") {
    return { start: startOfDay(inputDate(customStart)), end: endOfDay(inputDate(customEnd)) };
  }
  return currentMonthRange();
}

function containsTimestamp(range: PeriodRange, value: string | null) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return timestamp >= range.start.getTime() && timestamp <= range.end.getTime();
}

function containsDate(range: PeriodRange, value: string) {
  const date = inputDate(value).getTime();
  return date >= range.start.getTime() && date <= range.end.getTime();
}

function periodLabel(range: PeriodRange) {
  const formatter = new Intl.DateTimeFormat("pt-BR");
  return `${formatter.format(range.start)} a ${formatter.format(range.end)}`;
}

export function FinancePage() {
  const initialMonth = currentMonthRange();
  const [orders, setOrders] = useState<OrderDetails[]>([]);
  const [closings, setClosings] = useState<WeeklyClosing[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<OrderDetails | null>(null);
  const [closingDetail, setClosingDetail] = useState<WeeklyClosing | null>(null);
  const [payingClosingId, setPayingClosingId] = useState<number | null>(null);
  const [tab, setTab] = useState<FinanceTab>("summary");
  const [preset, setPreset] = useState<FinancePeriodPreset>("this_month");
  const [customStart, setCustomStart] = useState(() => dateInputValue(initialMonth.start));
  const [customEnd, setCustomEnd] = useState(() => dateInputValue(initialMonth.end));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaries, closingList, employeeList] = await Promise.all([
        api.get<OrderSummary[]>("/orders"),
        api.get<WeeklyClosing[]>("/weekly-closings"),
        api.get<Employee[]>("/employees")
      ]);
      const details = await Promise.all(summaries.map((order) => api.get<OrderDetails>(`/orders/${order.id}`)));
      setOrders(details);
      setClosings(closingList);
      setEmployees(employeeList);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel carregar o financeiro.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const range = useMemo(() => periodRange(preset, customStart, customEnd), [customEnd, customStart, preset]);

  function replaceOrder(updated: OrderDetails) {
    setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
  }

  function replaceClosing(updated: WeeklyClosing) {
    setClosings((current) => current.map((closing) => (closing.id === updated.id ? updated : closing)));
    setClosingDetail((current) => (current?.id === updated.id ? updated : current));
  }

  const periodOrders = useMemo(
    () => orders.filter((order) => containsTimestamp(range, order.created_at)),
    [orders, range]
  );

  const receivableOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          containsTimestamp(range, order.created_at) ||
          order.payments.some((payment) => containsTimestamp(range, payment.paid_at))
      ),
    [orders, range]
  );

  const payoutRows = useMemo<PayoutRow[]>(
    () =>
      orders.flatMap((order) =>
        order.outsourcings
          .filter((outsourcing) => outsourcing.status !== "cancelled")
          .map((outsourcing) => ({
            order,
            outsourcing
          }))
      ),
    [orders]
  );

  const periodPayoutRows = useMemo(
    () =>
      payoutRows.filter((row) =>
        row.outsourcing.payout_status === "paid"
          ? containsTimestamp(range, row.outsourcing.paid_at)
          : containsTimestamp(range, row.outsourcing.sent_at || row.order.created_at)
      ),
    [payoutRows, range]
  );

  const periodClosings = useMemo(
    () =>
      closings.filter((closing) =>
        closing.status === "paid"
          ? containsTimestamp(range, closing.paid_at)
          : containsDate(range, closing.end_date)
      ),
    [closings, range]
  );

  const summary = useMemo<FinanceSummary>(() => {
    const totalReceived = orders.reduce(
      (total, order) =>
        total +
        order.payments
          .filter((payment) => containsTimestamp(range, payment.paid_at))
          .reduce((paymentTotal, payment) => paymentTotal + money(payment.amount), 0),
      0
    );
    const employeePaid = periodClosings
      .filter((closing) => closing.status === "paid")
      .reduce((total, closing) => total + money(closing.total_payable), 0);
    const employeePending = periodClosings
      .filter((closing) => closing.status !== "paid")
      .reduce((total, closing) => total + money(closing.total_payable), 0);
    const payoutPaid = periodPayoutRows
      .filter((row) => row.outsourcing.payout_status === "paid")
      .reduce((total, row) => total + money(row.outsourcing.outsourcer_total), 0);
    const payoutPending = periodPayoutRows
      .filter((row) => row.outsourcing.payout_status === "pending")
      .reduce((total, row) => total + money(row.outsourcing.outsourcer_total), 0);
    const outsourcingCostTotal = payoutPaid + payoutPending;
    const totalInvoiced = periodOrders.reduce((total, order) => total + money(order.total_amount), 0);

    return {
      totalInvoiced,
      totalReceived,
      totalPending: periodOrders.reduce((total, order) => total + money(order.amount_due), 0),
      employeePaid,
      employeePending,
      payoutPaid,
      payoutPending,
      outsourcingCostTotal,
      cashResult: totalReceived - employeePaid - payoutPaid,
      projectedResult: totalInvoiced - employeePaid - employeePending - outsourcingCostTotal
    };
  }, [orders, periodClosings, periodOrders, periodPayoutRows, range]);

  function handlePaymentUpdated(updated: OrderDetails) {
    replaceOrder(updated);
    setFeedback("Pagamento registrado com sucesso.");
  }

  function handlePayoutUpdated(updated: OrderDetails) {
    replaceOrder(updated);
    setFeedback("Repasse marcado como pago.");
  }

  async function showClosingDetail(closing: WeeklyClosing) {
    setError(null);
    try {
      const current = await api.get<WeeklyClosing>(`/weekly-closings/${closing.id}`);
      replaceClosing(current);
      setClosingDetail(current);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel abrir o fechamento.");
    }
  }

  async function payClosing(closing: WeeklyClosing) {
    setPayingClosingId(closing.id);
    setError(null);
    try {
      const updated = await api.post<WeeklyClosing>(`/weekly-closings/${closing.id}/pay`, {});
      replaceClosing(updated);
      setFeedback("Fechamento marcado como pago.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel pagar o fechamento.");
    } finally {
      setPayingClosingId(null);
    }
  }

  function changeCustomStart(value: string) {
    if (!value) return;
    setCustomStart(value);
    if (value > customEnd) setCustomEnd(value);
  }

  function changeCustomEnd(value: string) {
    if (!value) return;
    setCustomEnd(value);
    if (value < customStart) setCustomStart(value);
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Gratao Flow</p>
        <h1 className="mt-1 text-3xl font-black text-ink">Financeiro</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Entradas, saidas e resultado por periodo</p>
      </div>

      <FinancePeriodFilter
        preset={preset}
        startDate={customStart}
        endDate={customEnd}
        label={periodLabel(range)}
        onPresetChange={setPreset}
        onStartDateChange={changeCustomStart}
        onEndDateChange={changeCustomEnd}
      />

      {feedback ? (
        <div className="rounded-md border border-success/20 bg-success/10 p-4 text-sm font-semibold text-success">
          {feedback}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger/10 p-4 text-sm font-semibold text-danger">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-lg border border-line/80 bg-white/92 p-2 shadow-soft">
        {tabs.map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant={tab === value ? "primary" : "ghost"}
            className="h-10"
            onClick={() => setTab(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === "summary" ? <FinanceSummaryCards summary={summary} /> : null}
      {tab === "receivables" ? (
        <ReceivablesTable orders={receivableOrders} loading={loading} onAddPayment={setPaymentOrder} />
      ) : null}
      {tab === "employees" ? (
        <EmployeeClosingsTable
          closings={periodClosings}
          employees={employees}
          loading={loading}
          payingId={payingClosingId}
          onDetail={(closing) => void showClosingDetail(closing)}
          onPay={(closing) => void payClosing(closing)}
        />
      ) : null}
      {tab === "outsourcing" ? (
        <PayoutsTable rows={periodPayoutRows} loading={loading} onPaid={handlePayoutUpdated} onError={setError} />
      ) : null}

      <FinancePaymentModal
        order={paymentOrder}
        onClose={() => setPaymentOrder(null)}
        onUpdated={handlePaymentUpdated}
      />
      <WeeklyClosingDetailModal
        closing={closingDetail}
        employees={employees}
        onClose={() => setClosingDetail(null)}
      />
    </div>
  );
}
