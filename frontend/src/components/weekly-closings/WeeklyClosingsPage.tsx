"use client";

import { useCallback, useEffect, useState } from "react";
import type { Employee, WorkLog } from "@/components/employees/types";
import { WeeklyClosingCreateModal } from "@/components/weekly-closings/WeeklyClosingCreateModal";
import { WeeklyClosingDetailModal } from "@/components/weekly-closings/WeeklyClosingDetailModal";
import { WeeklyClosingSummaryCards } from "@/components/weekly-closings/WeeklyClosingSummaryCards";
import { WeeklyClosingsTable } from "@/components/weekly-closings/WeeklyClosingsTable";
import type { WeeklyClosing } from "@/components/weekly-closings/types";
import { api } from "@/lib/api";

export function WeeklyClosingsPage() {
  const [closings, setClosings] = useState<WeeklyClosing[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<WeeklyClosing | null>(null);
  const [changingId, setChangingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [closingList, employeeList, logList] = await Promise.all([
        api.get<WeeklyClosing[]>("/weekly-closings"),
        api.get<Employee[]>("/employees"),
        api.get<WorkLog[]>("/work-logs")
      ]);
      setClosings(closingList);
      setEmployees(employeeList);
      setWorkLogs(logList);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel carregar fechamentos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function upsert(closing: WeeklyClosing) {
    setClosings((current) => [closing, ...current.filter((item) => item.id !== closing.id)]);
    setDetail((current) => (current?.id === closing.id ? closing : current));
  }

  async function showDetail(closing: WeeklyClosing) {
    setError(null);
    try {
      const fresh = await api.get<WeeklyClosing>(`/weekly-closings/${closing.id}`);
      upsert(fresh);
      setDetail(fresh);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel abrir o fechamento.");
    }
  }

  async function closeWeek(closing: WeeklyClosing) {
    setChangingId(closing.id);
    setError(null);
    try {
      const updated = await api.post<WeeklyClosing>(`/weekly-closings/${closing.id}/close`, {});
      upsert(updated);
      setFeedback("Fechamento marcado como fechado.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel fechar a semana.");
    } finally {
      setChangingId(null);
    }
  }

  async function payWeek(closing: WeeklyClosing) {
    setChangingId(closing.id);
    setError(null);
    try {
      const updated = await api.post<WeeklyClosing>(`/weekly-closings/${closing.id}/pay`, {});
      upsert(updated);
      setFeedback("Fechamento marcado como pago.");
      void load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel pagar a semana.");
    } finally {
      setChangingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Gratao Flow</p>
        <h1 className="mt-1 text-3xl font-black text-ink">Fechamentos Semanais</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Pagamento semanal individual por funcionario</p>
      </div>

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

      <WeeklyClosingSummaryCards closings={closings} />
      <WeeklyClosingsTable
        closings={closings}
        employees={employees}
        loading={loading}
        changingId={changingId}
        onCreate={() => setCreateOpen(true)}
        onDetail={showDetail}
        onCloseWeek={(closing) => void closeWeek(closing)}
        onPayWeek={(closing) => void payWeek(closing)}
      />
      <WeeklyClosingCreateModal
        open={createOpen}
        employees={employees}
        workLogs={workLogs}
        onClose={() => setCreateOpen(false)}
        onCreated={(closing) => {
          upsert(closing);
          setFeedback("Fechamento criado com sucesso.");
          void load();
        }}
      />
      <WeeklyClosingDetailModal
        closing={detail}
        employees={employees}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}
