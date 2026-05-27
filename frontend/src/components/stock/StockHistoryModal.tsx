"use client";

import { History, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { StockItem, StockItemDetail, StockMovementType } from "./types";

type Props = {
  item: StockItem | null;
  onClose: () => void;
};

const movementLabels: Record<StockMovementType, string> = {
  entry: "Entrada manual",
  exit: "Saida",
  adjustment: "Ajuste",
  excess_cut: "Excedente de corte registrado",
  cut_entry: "Corte registrado",
  allocated_to_order: "Destinado para OS",
  returned_from_order: "Devolvido pela OS",
  loss: "Perda"
};

export function StockHistoryModal({ item, onClose }: Props) {
  const [detail, setDetail] = useState<StockItemDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!item) {
      setDetail(null);
      setError(null);
      setLoading(false);
      return;
    }

    const selectedItem = item;

    async function loadHistory() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<StockItemDetail>(`/stock/items/${selectedItem.id}`);
        if (active) setDetail(data);
      } catch (requestError) {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : "Nao foi possivel carregar o historico.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadHistory();
    return () => {
      active = false;
    };
  }, [item]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-nav/45 p-4 backdrop-blur-sm">
      <div className="h-full w-full max-w-4xl overflow-hidden rounded-lg border border-line bg-white shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Historico</p>
            <h2 className="mt-1 text-xl font-black text-ink">{item.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-md text-muted transition hover:bg-[#FCFAF6] hover:text-ink focus-visible:focus-ring"
            aria-label="Fechar historico"
          >
            <X size={18} />
          </button>
        </div>
        <div className="h-[calc(100%-73px)] overflow-y-auto p-5">
          {error ? (
            <div className="rounded-md border border-danger/20 bg-danger/10 p-3 text-sm font-semibold text-danger">
              {error}
            </div>
          ) : loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
              ))}
            </div>
          ) : !detail || detail.movements.length === 0 ? (
            <EmptyState
              icon={<History size={20} />}
              title="Sem movimentacoes"
              description="Este item ainda nao possui historico registrado."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="bg-[#FCFAF6] text-xs font-black uppercase tracking-[0.12em] text-muted">
                    {["Tipo", "Quantidade", "Anterior", "Novo", "Referencia", "Data", "Notas"].map((heading) => (
                      <th key={heading} className="border-b border-line px-4 py-3">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.movements.map((movement) => (
                    <tr key={movement.id}>
                      <td className="border-b border-line/70 px-4 py-4">
                        <Badge tone="accent">{movementLabels[movement.movement_type]}</Badge>
                      </td>
                      <td className="border-b border-line/70 px-4 py-4 font-bold text-ink">
                        {formatNumber(Number(movement.quantity))}
                      </td>
                      <td className="border-b border-line/70 px-4 py-4 text-muted">
                        {formatNumber(Number(movement.previous_quantity))}
                      </td>
                      <td className="border-b border-line/70 px-4 py-4 text-muted">
                        {formatNumber(Number(movement.new_quantity))}
                      </td>
                      <td className="border-b border-line/70 px-4 py-4 text-muted">
                        {movement.reference_type ? `${movement.reference_type} #${movement.reference_id ?? "-"}` : "-"}
                      </td>
                      <td className="border-b border-line/70 px-4 py-4 text-muted">
                        {formatDateTime(movement.created_at)}
                      </td>
                      <td className="border-b border-line/70 px-4 py-4 text-muted">{movement.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
