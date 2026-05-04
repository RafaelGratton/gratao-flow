"use client";

import { useCallback, useEffect, useState } from "react";
import { WeeklyClosingCreateModal } from "@/components/weekly-closings/WeeklyClosingCreateModal";
import { WeeklyClosingDetailModal } from "@/components/weekly-closings/WeeklyClosingDetailModal";
import { WeeklyClosingSummaryCards } from "@/components/weekly-closings/WeeklyClosingSummaryCards";
import { WeeklyClosingsTable } from "@/components/weekly-closings/WeeklyClosingsTable";
import type { WeeklyClosing } from "@/components/weekly-closings/types";
import { api } from "@/lib/api";

export function WeeklyClosingsPage() {
  const [closings, setClosings] = useState<WeeklyClosing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<WeeklyClosing | null>(null);
  const [closingId, setClosingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<WeeklyClosing[]>("/weekly-closings");
      setClosings(result);
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
    const confirmed = window.confirm(
      "Apos fechar a semana, as OS associadas ficam bloqueadas para alteracoes produtivas e financeiras."
    );
    if (!confirmed) return;

    setClosingId(closing.id);
    setError(null);
    try {
      const updated = await api.post<WeeklyClosing>(`/weekly-closings/${closing.id}/close`, {});
      upsert(updated);
      setFeedback("Fechamento marcado como fechado.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel fechar a semana.");
    } finally {
      setClosingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Gratão Flow</p>
        <h1 className="mt-1 text-3xl font-black text-ink">Fechamentos Semanais</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Consolidacao financeira e operacional por periodo
        </p>
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
        loading={loading}
        closingId={closingId}
        onCreate={() => setCreateOpen(true)}
        onDetail={showDetail}
        onCloseWeek={closeWeek}
      />
      <WeeklyClosingCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(closing) => {
          upsert(closing);
          setFeedback("Fechamento criado com sucesso.");
        }}
      />
      <WeeklyClosingDetailModal closing={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
