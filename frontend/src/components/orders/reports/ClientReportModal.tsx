"use client";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { MoneySummary, PaymentsList, ReportField, ReportGrid, ReportSection, ServicesList } from "./ReportSections";
import { ReportModalShell } from "./ReportModalShell";
import type { ClientOrderReport } from "./types";

type ClientReportModalProps = {
  open: boolean;
  report: ClientOrderReport | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
};

export function ClientReportModal({ open, report, loading, error, onClose }: ClientReportModalProps) {
  return (
    <ReportModalShell
      open={open}
      onClose={onClose}
      title="Relatório do cliente"
      description="Resumo limpo do pedido, sem dados internos ou financeiros sensíveis."
    >
      {loading ? <ClientReportLoading /> : null}
      {error ? <EmptyState title="Não foi possível carregar o relatório" description={error} /> : null}
      {!loading && !error && report ? (
        <div className="space-y-6">
          <div className="rounded-lg border border-accent/25 bg-accent-soft/35 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-dark">Gratão Uniformes</p>
                <h3 className="mt-1 text-xl font-black text-ink">Pedido #{report.order_id}</h3>
              </div>
              <Badge tone="success">{report.production_status}</Badge>
            </div>
          </div>

          <ReportSection title="Dados do pedido">
            <ReportGrid>
              <ReportField label="Cliente" value={report.client.name} />
              <ReportField label="OS" value={`#${report.order_id}`} />
              <ReportField label="Produto" value={report.product.name} />
              <ReportField label="Tamanho" value={report.size.label} />
              <ReportField label="Cor" value={report.color} />
              <ReportField label="Quantidade" value={report.quantity} />
            </ReportGrid>
          </ReportSection>

          <ReportSection title="Serviços">
            <ServicesList services={report.services} />
          </ReportSection>

          <ReportSection title="Resumo financeiro">
            <MoneySummary total={report.total_amount} paid={report.amount_paid} due={report.amount_due} />
          </ReportSection>

          <ReportSection title="Pagamentos">
            <PaymentsList payments={report.payments} />
          </ReportSection>
        </div>
      ) : null}
    </ReportModalShell>
  );
}

function ClientReportLoading() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-20 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
      ))}
    </div>
  );
}
