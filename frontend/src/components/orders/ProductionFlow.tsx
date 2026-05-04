"use client";

import { CheckCircle2, Scissors, Shirt, Stamp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { OrderDetails } from "@/components/orders/types";
import { hasPrintingService } from "@/components/orders/status";
import { cn } from "@/lib/utils";

type ProductionFlowProps = {
  order: OrderDetails;
  onAction: (action: "cut" | "print" | "sew") => void;
};

export function ProductionFlow({ order, onAction }: ProductionFlowProps) {
  const needsPrint = hasPrintingService(order.services);
  const cutDone = order.quantity_cut > 0;
  const printDone = !needsPrint || order.quantity_printed >= order.quantity_cut;
  const sewDone = order.quantity_sewn >= order.quantity_cut && order.quantity_cut > 0;

  const canCut = !["cancelled", "delivered"].includes(order.production_status);
  const canPrint =
    needsPrint &&
    ["cut_done", "in_print"].includes(order.production_status) &&
    order.quantity_printed < order.quantity_cut;
  const canSew =
    (needsPrint
      ? ["print_done", "in_sewing"].includes(order.production_status)
      : ["cut_done", "in_sewing"].includes(order.production_status)) &&
    order.quantity_sewn < order.quantity_cut;

  const steps = [
    {
      key: "cut" as const,
      label: "Corte",
      value: order.quantity_cut,
      total: order.quantity_requested,
      done: cutDone,
      active: ["created", "in_cut", "cut_done"].includes(order.production_status),
      icon: Scissors,
      actionLabel: "Registrar corte",
      disabled: !canCut
    },
    {
      key: "print" as const,
      label: "Serigrafia",
      value: order.quantity_printed,
      total: order.quantity_cut,
      done: needsPrint ? printDone : true,
      active: ["waiting_print", "in_print", "print_done", "cut_done"].includes(order.production_status),
      icon: Stamp,
      actionLabel: "Registrar serigrafia",
      disabled: !canPrint,
      muted: !needsPrint
    },
    {
      key: "sew" as const,
      label: "Confecção",
      value: order.quantity_sewn,
      total: order.quantity_cut,
      done: sewDone,
      active: ["waiting_sewing", "in_sewing", "sewing_done", "print_done", "cut_done"].includes(
        order.production_status
      ),
      icon: Shirt,
      actionLabel: "Registrar confecção",
      disabled: !canSew
    }
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const progress =
            step.total > 0 ? Math.min(Math.round((step.value / step.total) * 100), 100) : 0;

          return (
            <div
              key={step.key}
              className={cn(
                "relative overflow-hidden rounded-lg border p-5",
                step.done
                  ? "border-success/25 bg-success/10"
                  : step.active
                    ? "border-accent/35 bg-accent-soft/45"
                    : "border-line bg-[#FCFAF6]",
                step.muted && "opacity-70"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "grid h-11 w-11 place-items-center rounded-md bg-white shadow-insetline",
                      step.done ? "text-success" : step.active ? "text-accent-dark" : "text-muted"
                    )}
                  >
                    {step.done ? <CheckCircle2 size={20} /> : <Icon size={20} />}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                      Etapa {index + 1}
                    </p>
                    <h3 className="text-base font-black text-ink">{step.label}</h3>
                  </div>
                </div>
                <span className="text-2xl font-black text-ink">{step.value}</span>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex justify-between text-xs font-bold text-muted">
                  <span>{step.muted ? "Não aplicável" : `${progress}% concluído`}</span>
                  <span>
                    {step.value}/{step.total || 0}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white shadow-insetline">
                  <div
                    className={cn("h-full rounded-full", step.done ? "bg-success" : "bg-accent")}
                    style={{ width: `${step.muted ? 100 : progress}%` }}
                  />
                </div>
              </div>

              <Button
                type="button"
                variant={step.disabled ? "secondary" : "primary"}
                className="mt-5 w-full"
                disabled={step.disabled}
                onClick={() => onAction(step.key)}
              >
                {step.actionLabel}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 rounded-lg border border-line bg-[#FCFAF6] p-4 md:grid-cols-4">
        <Metric label="Solicitado" value={order.quantity_requested} />
        <Metric label="Cortado" value={order.quantity_cut} />
        <Metric label="Impresso" value={order.quantity_printed} />
        <Metric label="Confeccionado" value={order.quantity_sewn} />
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
