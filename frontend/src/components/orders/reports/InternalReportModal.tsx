"use client";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { financialLabels, productionLabels } from "@/components/orders/status";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { MoneySummary, PaymentsList, ReportField, ReportGrid, ReportItemsList, ReportSection } from "./ReportSections";
import { ReportModalShell } from "./ReportModalShell";
import type { InternalOrderReport } from "./types";

type InternalReportModalProps = {
  open: boolean;
  report: InternalOrderReport | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
};

export function InternalReportModal({ open, report, loading, error, onClose }: InternalReportModalProps) {
  return (
    <ReportModalShell
      open={open}
      onClose={onClose}
      title="Relatório interno"
      description="Visão operacional completa da OS para uso administrativo."
    >
      {loading ? <ReportLoading /> : null}
      {error ? <EmptyState title="Não foi possível carregar o relatório" description={error} /> : null}
      {!loading && !error && report ? (
        <div className="space-y-6">
          <ReportSection title="Dados da OS">
            <ReportGrid>
              <ReportField label="OS" value={`#${report.order_id}`} />
              <ReportField label="Cliente" value={report.client.name} />
              <ReportField label="Telefone" value={report.client.phone || "Não informado"} />
              <ReportField label="Produção" value={productionLabels[report.production_status]} />
              <ReportField label="Financeiro" value={financialLabels[report.financial_status]} />
            </ReportGrid>
          </ReportSection>

          <ReportSection title="Quantidades">
            <ReportGrid>
              <ReportField label="Solicitada" value={report.quantity_requested} />
              <ReportField label="Pecas destinadas" value={report.quantity_cut} />
              <ReportField label="Serigrafada" value={report.quantity_printed} />
              <ReportField label="Costurada" value={report.quantity_sewn} />
              <ReportField label="Excedente historico" value={report.quantity_extra} />
            </ReportGrid>
          </ReportSection>

          <ReportSection title="Serviços">
            <ReportItemsList items={report.items} />
          </ReportSection>

          <ReportSection title="Pagamentos">
            <PaymentsList payments={report.payments} showNotes />
          </ReportSection>

          <ReportSection title="Totais financeiros">
            <MoneySummary total={report.total_amount} paid={report.amount_paid} due={report.amount_due} />
          </ReportSection>

          <ReportSection title="Eventos produtivos">
            {report.production_events.length === 0 ? (
              <EmptyState title="Sem eventos" description="Nenhum evento produtivo foi registrado nesta OS." />
            ) : (
              <div className="space-y-2">
                {report.production_events.map((event) => (
                  <div key={`${event.event_type}-${event.created_at}`} className="rounded-md border border-line bg-white p-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="accent">{eventLabel(event.event_type)}</Badge>
                        {event.order_item_id ? <span className="text-sm font-semibold text-muted">Item #{event.order_item_id}</span> : null}
                        {event.quantity !== null ? <span className="text-sm font-semibold text-muted">Qtd. {event.quantity}</span> : null}
                      </div>
                      <span className="text-sm font-semibold text-muted">{formatDateTime(event.created_at)}</span>
                    </div>
                    {event.notes ? <p className="mt-2 text-sm text-muted">{event.notes}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </ReportSection>

          <ReportSection title="Terceirizações">
            {report.outsourcings.length === 0 ? (
              <EmptyState title="Sem terceirizações" description="Nenhuma terceirização foi registrada nesta OS." />
            ) : (
              <div className="space-y-2">
                {report.outsourcings.map((outsourcing, index) => (
                  <div key={`${outsourcing.outsourcer}-${index}`} className="rounded-md border border-line bg-white p-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <p className="font-black text-ink">{outsourcing.outsourcer ?? "Sem terceirizado"}</p>
                      <div className="flex flex-wrap gap-2">
                        {outsourcing.order_item_id ? <Badge tone="accent">Item #{outsourcing.order_item_id}</Badge> : null}
                        <Badge>{outsourcing.status}</Badge>
                        <Badge tone={outsourcing.payout_status === "paid" ? "success" : "warning"}>
                          Repasse {outsourcing.payout_status}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3">
                      <ReportGrid>
                      <ReportField label="Enviado" value={outsourcing.quantity_sent} />
                      <ReportField label="Retornado" value={outsourcing.quantity_returned} />
                      <ReportField label="Preço cliente" value={formatCurrency(outsourcing.customer_unit_price)} />
                      <ReportField label="Repasse unitário" value={formatCurrency(outsourcing.outsourcer_unit_price)} />
                      <ReportField label="Total cliente" value={formatCurrency(outsourcing.customer_total)} />
                      <ReportField label="Total repasse" value={formatCurrency(outsourcing.outsourcer_total)} />
                      <ReportField label="Resultado ref." value={formatCurrency(outsourcing.profit_total)} />
                      </ReportGrid>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ReportSection>
        </div>
      ) : null}
    </ReportModalShell>
  );
}

function ReportLoading() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-20 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
      ))}
    </div>
  );
}

function eventLabel(eventType: string) {
  if (eventType === "cut_registered") return "Corte registrado no estoque";
  if (eventType === "cut_pieces_allocated") return "Pecas destinadas para OS";
  if (eventType === "cut_pieces_returned") return "Pecas devolvidas ao estoque";
  if (eventType === "production_paused") return "Producao pausada";
  if (eventType === "production_resumed") return "Producao retomada";
  if (eventType === "print_registered") return "DTF/serigrafia registrada";
  if (eventType === "sewing_registered") return "Confeccao registrada";
  if (eventType === "outsourcing_sent") return "Terceirizacao enviada";
  if (eventType === "outsourcing_returned") return "Retorno da terceirizacao";
  return eventType;
}
