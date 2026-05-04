"use client";

import { ArrowUpRight, ClipboardList, Plus, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { OrderSummary } from "@/components/orders/types";
import {
  financialLabels,
  financialTone,
  productionLabels,
  productionTone
} from "@/components/orders/status";
import { formatCurrency } from "@/lib/format";

type OrderTableProps = {
  orders: OrderSummary[];
  loading: boolean;
  onCancel: (order: OrderSummary) => void;
};

export function OrderTable({ orders, loading, onCancel }: OrderTableProps) {
  const router = useRouter();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-white/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
              Ordens de serviço
            </p>
            <h1 className="mt-1 text-2xl font-black text-ink">Esteira de OS</h1>
          </div>
          <Link href="/orders/new">
            <Button>
              <Plus size={18} />
              Nova OS
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-md border border-line bg-[#FCFAF6]"
              />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<ClipboardList size={20} />}
              title="Nenhuma OS cadastrada"
              description="Crie a primeira ordem para acompanhar producao, pagamentos e valores em um unico lugar."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1080px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-[#FCFAF6] text-xs font-black uppercase tracking-[0.12em] text-muted">
                  {[
                    "ID",
                    "Cliente",
                    "Produto",
                    "Tamanho",
                    "Cor",
                    "Quantidade",
                    "Status producao",
                    "Status financeiro",
                    "Total",
                    "Pago",
                    "Acoes"
                  ].map((heading) => (
                    <th key={heading} className="border-b border-line px-4 py-3">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => router.push(`/orders/${order.id}`)}
                    className="cursor-pointer transition hover:bg-accent-soft/28"
                  >
                    <td className="border-b border-line/70 px-4 py-4 font-black text-ink">
                      #{order.id}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 font-semibold text-ink">
                      {order.client.name}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">
                      {order.product.name}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">
                      {order.size.label}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">
                      {order.color}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 font-bold text-ink">
                      {order.quantity_requested}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4">
                      <StatusBadge
                        label={productionLabels[order.production_status]}
                        status={productionTone(order.production_status)}
                      />
                    </td>
                    <td className="border-b border-line/70 px-4 py-4">
                      <StatusBadge
                        label={financialLabels[order.financial_status]}
                        status={financialTone(order.financial_status)}
                      />
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 font-bold text-ink">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 text-muted">
                      {formatCurrency(order.amount_paid)}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-9 px-3"
                          onClick={(event) => {
                            event.stopPropagation();
                            router.push(`/orders/${order.id}`);
                          }}
                        >
                          Abrir
                          <ArrowUpRight size={16} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-9 px-3 text-danger hover:text-danger"
                          onClick={(event) => {
                            event.stopPropagation();
                            onCancel(order);
                          }}
                        >
                          <XCircle size={16} />
                          Cancelar OS
                        </Button>
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
