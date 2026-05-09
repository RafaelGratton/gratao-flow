"use client";

import { CheckCircle2, Scissors, Shirt, Stamp, Truck } from "lucide-react";
import { productionFlowLabels } from "@/components/orders/status";
import type { OrderDetails, OrderItem } from "@/components/orders/types";
import { flowStageOptions, itemStageDone, missingCut } from "@/components/production/helpers";
import { cn } from "@/lib/utils";

type ProductionFlowProps = {
  order: OrderDetails;
};

export function ProductionFlow({ order }: ProductionFlowProps) {
  return (
    <div className="space-y-4">
      {order.items.map((item, index) => (
        <div key={item.id} className="rounded-lg border border-line bg-[#FCFAF6] p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent-dark">
                Item {index + 1}
              </p>
              <h3 className="mt-1 text-base font-black text-ink">
                {item.product.name} tamanho {item.size.label}
              </h3>
              <p className="mt-1 text-sm font-semibold text-muted">{productionFlowLabels[item.production_flow]}</p>
            </div>
            <p className="text-sm font-black text-ink">{item.quantity_requested} pecas</p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <Metric label="Solicitado" value={item.quantity_requested} />
            <Metric label="Cortado" value={item.quantity_cut} />
            <Metric label="Estampado" value={item.quantity_printed} />
            <Metric label="Confeccionado" value={item.quantity_sewn} />
          </div>
          <div className="mt-3">
            <Metric label="Faltam cortar" value={missingCut(item)} />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {flowStageOptions(item.production_flow).map((stage) => (
              <Stage key={stage} item={item} stage={stage} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Stage({
  item,
  stage
}: {
  item: OrderItem;
  stage: "cut" | "print" | "sew" | "outsourcing";
}) {
  const done =
    stage === "outsourcing"
      ? itemStageDone(item, "cut")
      : itemStageDone(item, stage);
  const Icon = stage === "cut" ? Scissors : stage === "print" ? Stamp : stage === "sew" ? Shirt : Truck;
  const label =
    stage === "cut"
      ? "Corte"
      : stage === "print"
        ? "Serigrafia"
        : stage === "sew"
          ? "Confeccao"
          : "Terceirizacao";

  return (
    <div
      className={cn(
        "rounded-md border p-3",
        done ? "border-success/25 bg-success/10" : "border-line bg-white"
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn("grid h-9 w-9 place-items-center rounded-md bg-white shadow-insetline", done ? "text-success" : "text-muted")}>
          {done && stage !== "outsourcing" ? <CheckCircle2 size={18} /> : <Icon size={18} />}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Etapa</p>
          <p className="font-black text-ink">{label}</p>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white p-3 shadow-insetline">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 text-xl font-black text-ink">{value}</p>
    </div>
  );
}
