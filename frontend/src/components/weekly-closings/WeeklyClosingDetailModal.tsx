"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { WeeklyClosing } from "@/components/weekly-closings/types";
import { formatCurrency, formatDateTime } from "@/lib/format";

type Props = {
  closing: WeeklyClosing | null;
  onClose: () => void;
};

const moneyFields: Array<[keyof WeeklyClosing, string]> = [
  ["total_invoiced", "Faturado"],
  ["total_received", "Recebido"],
  ["total_pending", "Pendente"],
  ["total_outsourcing_customer", "Terceirização cliente"],
  ["total_outsourcing_payout", "Repasse terceirização"],
  ["total_outsourcing_profit", "Lucro terceirização"],
  ["total_payout_paid", "Repasses pagos"],
  ["total_payout_pending", "Repasses pendentes"],
  ["gross_result", "Resultado bruto"]
];

const quantityFields: Array<[keyof WeeklyClosing, string]> = [
  ["total_orders", "Total OS"],
  ["total_pieces_requested", "Pecas solicitadas"],
  ["total_pieces_cut", "Pecas cortadas"],
  ["total_pieces_printed", "Pecas estampadas"],
  ["total_pieces_sewn", "Pecas costuradas"]
];

export function WeeklyClosingDetailModal({ closing, onClose }: Props) {
  if (!closing) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-dark">
              {closing.start_date} a {closing.end_date}
            </p>
            <h2 className="mt-1 text-lg font-black text-ink">Detalhe do fechamento</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-md text-muted transition hover:bg-[#FCFAF6] hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[calc(90vh-76px)] space-y-5 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge label={closing.status === "closed" ? "Fechado" : "Aberto"} status={closing.status === "closed" ? "done" : "active"} />
            <span className="text-sm font-semibold text-muted">
              Fechado em: {closing.closed_at ? formatDateTime(closing.closed_at) : "Ainda aberto"}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {quantityFields.map(([field, label]) => (
              <div key={field} className="rounded-md border border-line bg-[#FCFAF6] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
                <p className="mt-2 text-2xl font-black text-ink">{closing[field]}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {moneyFields.map(([field, label]) => (
              <div key={field} className="rounded-md border border-line bg-white p-4 shadow-insetline">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
                <p className="mt-2 text-lg font-black text-ink">{formatCurrency(String(closing[field]))}</p>
              </div>
            ))}
          </div>
          <div className="rounded-md border border-line bg-[#FCFAF6] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Notas</p>
            <p className="mt-2 text-sm leading-6 text-ink">{closing.notes || "Sem notas."}</p>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Fechar detalhe
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
