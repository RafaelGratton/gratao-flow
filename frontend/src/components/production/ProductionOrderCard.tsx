"use client";

import { ArrowRight, ExternalLink, Scissors, Shirt } from "lucide-react";
import type { ReactNode } from "react";
import { financialLabels, financialTone, productionLabels, productionTone } from "@/components/orders/status";
import type { OrderDetails } from "@/components/orders/types";
import { printingServiceLabel, serviceList } from "@/components/production/helpers";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";

type ProductionStage = "cut" | "printing" | "sewing" | "outsourcing" | "finishing";

type Props = {
  order: OrderDetails;
  stage: ProductionStage;
  previousStatus?: string;
  onCut?: (order: OrderDetails) => void;
  onSew?: (order: OrderDetails) => void;
  onGoPrinting?: () => void;
  onGoOutsourcing?: () => void;
};

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className="mt-1 text-sm font-black text-ink">{value}</p>
    </div>
  );
}

export function ProductionOrderCard({
  order,
  stage,
  previousStatus,
  onCut,
  onSew,
  onGoPrinting,
  onGoOutsourcing
}: Props) {
  return (
    <div className="grid gap-4 rounded-lg border border-line bg-white p-4 shadow-insetline transition hover:border-accent/40 hover:bg-accent-soft/20 xl:grid-cols-[1.2fr_1fr_auto] xl:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-black text-ink">OS #{order.id}</span>
          <StatusBadge label={productionLabels[order.production_status]} status={productionTone(order.production_status)} />
          {stage === "finishing" ? (
            <StatusBadge label={financialLabels[order.financial_status]} status={financialTone(order.financial_status)} />
          ) : null}
        </div>
        <p className="mt-1 text-sm font-semibold text-muted">{order.client.name}</p>
        <p className="mt-3 text-sm text-muted">
          <span className="font-bold text-ink">{order.product.name}</span> / {order.size.label} / {order.color}
        </p>
      </div>

      <div className="grid gap-3 rounded-md border border-line bg-[#FCFAF6] p-3 sm:grid-cols-2">
        {stage === "cut" ? (
          <>
            <Detail label="Quantidade" value={order.quantity_requested} />
            <Detail label="Serviços" value={serviceList(order)} />
          </>
        ) : null}
        {stage === "printing" ? (
          <>
            <Detail label="Quantidade" value={order.quantity_requested} />
            <Detail label="Tipo de serigrafia" value={printingServiceLabel(order)} />
          </>
        ) : null}
        {stage === "sewing" ? (
          <>
            <Detail label="Quantidade" value={order.quantity_requested} />
            <Detail label="Status anterior" value={previousStatus ?? productionLabels[order.production_status]} />
          </>
        ) : null}
        {stage === "outsourcing" ? (
          <>
            <Detail label="Quantidade" value={order.quantity_requested} />
            <Detail label="Base disponível" value={order.production_status === "cut_done" ? order.quantity_cut : order.quantity_printed} />
          </>
        ) : null}
        {stage === "finishing" ? (
          <>
            <Detail label="Quantidade" value={order.quantity_requested} />
            <Detail label="Financeiro" value={financialLabels[order.financial_status]} />
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 xl:justify-end">
        {stage === "cut" ? (
          <Button type="button" onClick={() => onCut?.(order)}>
            <Scissors size={16} />
            Registrar corte
          </Button>
        ) : null}
        {stage === "printing" ? (
          <Button type="button" onClick={onGoPrinting}>
            <ExternalLink size={16} />
            Ir para serigrafia
          </Button>
        ) : null}
        {stage === "sewing" ? (
          <Button type="button" onClick={() => onSew?.(order)}>
            <Shirt size={16} />
            Registrar confecção
          </Button>
        ) : null}
        {stage === "outsourcing" ? (
          <Button type="button" variant="secondary" onClick={onGoOutsourcing}>
            <ArrowRight size={16} />
            Terceirizar
          </Button>
        ) : null}
        {stage === "finishing" ? <Badge tone="accent">Informativo</Badge> : null}
      </div>
    </div>
  );
}
