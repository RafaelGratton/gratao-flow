"use client";

import { Eye, LockKeyhole, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { WeeklyClosing } from "@/components/weekly-closings/types";
import { formatCurrency } from "@/lib/format";

type Props = {
  closings: WeeklyClosing[];
  loading: boolean;
  closingId: number | null;
  onCreate: () => void;
  onDetail: (closing: WeeklyClosing) => void;
  onCloseWeek: (closing: WeeklyClosing) => void;
};

export function WeeklyClosingsTable({ closings, loading, closingId, onCreate, onDetail, onCloseWeek }: Props) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-white/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Fechamentos</p>
            <h2 className="mt-1 text-xl font-black text-ink">Periodos consolidados</h2>
          </div>
          <Button type="button" onClick={onCreate}>
            <Plus size={18} />
            Novo fechamento
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
            ))}
          </div>
        ) : closings.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<LockKeyhole size={20} />}
              title="Nenhum fechamento criado"
              description="Crie um periodo para consolidar os totais financeiros e operacionais."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1220px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-[#FCFAF6] text-xs font-black uppercase tracking-[0.12em] text-muted">
                  {[
                    "Periodo",
                    "Status",
                    "Total OS",
                    "Faturado",
                    "Recebido",
                    "Pendente",
                    "Repasses pagos",
                    "Resultado bruto",
                    "Acoes"
                  ].map((heading) => (
                    <th key={heading} className="border-b border-line px-4 py-3">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {closings.map((closing) => (
                  <tr key={closing.id} className="transition hover:bg-accent-soft/20">
                    <td className="border-b border-line/70 px-4 py-4 font-black text-ink">
                      {closing.start_date} a {closing.end_date}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4">
                      <StatusBadge
                        label={closing.status === "closed" ? "Fechado" : "Aberto"}
                        status={closing.status === "closed" ? "done" : "active"}
                      />
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 font-bold text-ink">{closing.total_orders}</td>
                    <td className="border-b border-line/70 px-4 py-4 font-bold text-ink">
                      {formatCurrency(closing.total_invoiced)}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">
                      {formatCurrency(closing.total_received)}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">
                      {formatCurrency(closing.total_pending)}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">
                      {formatCurrency(closing.total_payout_paid)}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 font-black text-ink">
                      {formatCurrency(closing.gross_result)}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="secondary" className="h-10 px-3" onClick={() => onDetail(closing)}>
                          <Eye size={16} />
                          Ver detalhe
                        </Button>
                        {closing.status === "open" ? (
                          <Button
                            type="button"
                            className="h-10 px-3"
                            isLoading={closingId === closing.id}
                            onClick={() => onCloseWeek(closing)}
                          >
                            <LockKeyhole size={16} />
                            Fechar
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
