"use client";

import { History, Minus, PackagePlus, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatNumber } from "@/lib/format";
import type { StockItem } from "./types";

type Props = {
  items: StockItem[];
  loading: boolean;
  onCreate: () => void;
  onMovement: (item: StockItem, mode: "entry" | "exit" | "adjust") => void;
  onHistory: (item: StockItem) => void;
  onDelete: (item: StockItem) => void;
};

function categoryLabel(category: StockItem["category"]) {
  return category === "piece" ? "Peca" : "Material";
}

function statusFor(quantityValue: string) {
  const quantity = Number(quantityValue);
  if (quantity <= 0) {
    return { label: "Zerado", tone: "danger" as const };
  }
  if (quantity <= 5) {
    return { label: "Baixo", tone: "warning" as const };
  }
  return { label: "Em estoque", tone: "success" as const };
}

export function StockTable({ items, loading, onCreate, onMovement, onHistory, onDelete }: Props) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-white/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
              Itens de estoque
            </p>
            <h2 className="mt-1 text-2xl font-black text-ink">Saldos auditaveis</h2>
          </div>
          <Button type="button" onClick={onCreate}>
            <Plus size={18} />
            Novo item
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<PackagePlus size={20} />}
              title="Nenhum item cadastrado"
              description="Cadastre materiais ou pecas para controlar entradas, saidas e ajustes."
            >
              <Button type="button" className="mt-5" onClick={onCreate}>
                <Plus size={18} />
                Novo item
              </Button>
            </EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1120px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-[#FCFAF6] text-xs font-black uppercase tracking-[0.12em] text-muted">
                  {["Nome", "Categoria", "Produto/Tamanho", "Cor", "Unidade", "Quantidade", "Status", "Acoes"].map((heading) => (
                    <th key={heading} className="border-b border-line px-4 py-3">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const status = statusFor(item.quantity);
                  return (
                    <tr key={item.id} className="transition hover:bg-accent-soft/28">
                      <td className="border-b border-line/70 px-4 py-4 font-bold text-ink">{item.name}</td>
                      <td className="border-b border-line/70 px-4 py-4 text-muted">{categoryLabel(item.category)}</td>
                      <td className="border-b border-line/70 px-4 py-4 text-muted">
                        {item.category === "piece"
                          ? `${item.product?.name ?? "-"} / ${item.size?.label ?? "-"}`
                          : "-"}
                      </td>
                      <td className="border-b border-line/70 px-4 py-4 text-muted">{item.color || "-"}</td>
                      <td className="border-b border-line/70 px-4 py-4 text-muted">{item.unit}</td>
                      <td className="border-b border-line/70 px-4 py-4 font-black text-ink">
                        {formatNumber(Number(item.quantity))}
                      </td>
                      <td className="border-b border-line/70 px-4 py-4">
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </td>
                      <td className="border-b border-line/70 px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="secondary" className="h-9 px-3" onClick={() => onMovement(item, "entry")}>
                            <Plus size={15} />
                            Entrada
                          </Button>
                          <Button type="button" variant="secondary" className="h-9 px-3" onClick={() => onMovement(item, "exit")}>
                            <Minus size={15} />
                            Saida
                          </Button>
                          <Button type="button" variant="secondary" className="h-9 px-3" onClick={() => onMovement(item, "adjust")}>
                            <SlidersHorizontal size={15} />
                            Ajuste
                          </Button>
                          <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => onHistory(item)}>
                            <History size={15} />
                            Historico
                          </Button>
                          <Button type="button" variant="ghost" className="h-9 px-3 text-danger hover:text-danger" onClick={() => onDelete(item)}>
                            <Trash2 size={15} />
                            {item.can_delete ? "Excluir" : "Desativar"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
