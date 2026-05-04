"use client";

import { FileText, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ClientReportModal } from "@/components/orders/reports/ClientReportModal";
import { InternalReportModal } from "@/components/orders/reports/InternalReportModal";
import { ReportDownloadButton } from "@/components/orders/reports/ReportDownloadButton";
import type { ClientOrderReport, InternalOrderReport } from "@/components/orders/reports/types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { api } from "@/lib/api";

type OrderReportsCardProps = {
  orderId: number;
};

export function OrderReportsCard({ orderId }: OrderReportsCardProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [internalReport, setInternalReport] = useState<InternalOrderReport | null>(null);
  const [clientReport, setClientReport] = useState<ClientOrderReport | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const [clientLoading, setClientLoading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  async function openInternalReport() {
    setInternalOpen(true);
    setInternalLoading(true);
    setInternalError(null);

    try {
      const data = await api.get<InternalOrderReport>(`/orders/${orderId}/report/internal`);
      setInternalReport(data);
    } catch (requestError) {
      setInternalError(requestError instanceof Error ? requestError.message : "Não foi possível carregar o relatório interno.");
    } finally {
      setInternalLoading(false);
    }
  }

  async function openClientReport() {
    setClientOpen(true);
    setClientLoading(true);
    setClientError(null);

    try {
      const data = await api.get<ClientOrderReport>(`/orders/${orderId}/report/client`);
      setClientReport(data);
    } catch (requestError) {
      setClientError(requestError instanceof Error ? requestError.message : "Não foi possível carregar o relatório do cliente.");
    } finally {
      setClientLoading(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black text-ink">Relatórios</h2>
              <p className="mt-1 text-sm text-muted">
                Consulte os resumos da OS e baixe PDFs com o conteúdo adequado para cada público.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-muted">
              <ShieldCheck size={18} className="text-success" />
              Cliente sem dados sensíveis
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Button type="button" variant="primary" onClick={openInternalReport} isLoading={internalLoading}>
              <FileText size={18} />
              Ver relatório interno
            </Button>
            <Button type="button" variant="secondary" onClick={openClientReport} isLoading={clientLoading}>
              <FileText size={18} />
              Ver relatório do cliente
            </Button>
            <ReportDownloadButton
              endpoint={`/orders/${orderId}/report/internal/pdf`}
              fileName={`gratao-flow-os-${orderId}-interno.pdf`}
            >
              Baixar PDF interno
            </ReportDownloadButton>
            <ReportDownloadButton
              endpoint={`/orders/${orderId}/report/client/pdf`}
              fileName={`gratao-uniformes-pedido-${orderId}.pdf`}
            >
              Baixar PDF cliente
            </ReportDownloadButton>
          </div>
        </CardContent>
      </Card>

      <InternalReportModal
        open={internalOpen}
        report={internalReport}
        loading={internalLoading}
        error={internalError}
        onClose={() => setInternalOpen(false)}
      />
      <ClientReportModal
        open={clientOpen}
        report={clientReport}
        loading={clientLoading}
        error={clientError}
        onClose={() => setClientOpen(false)}
      />
    </>
  );
}
