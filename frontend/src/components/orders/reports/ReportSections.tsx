import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { ReportItem } from "./types";

export function ReportGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function ReportField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-[#FCFAF6] p-3">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
      <div className="mt-1 text-sm font-black text-ink">{value}</div>
    </div>
  );
}

export function ReportSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-black uppercase tracking-[0.14em] text-ink">{title}</h3>
      {children}
    </section>
  );
}

export function MoneySummary({
  total,
  paid,
  due
}: {
  total: string;
  paid: string;
  due: string;
}) {
  return (
    <ReportGrid>
      <ReportField label="Total do pedido" value={formatCurrency(total)} />
      <ReportField label="Pago" value={formatCurrency(paid)} />
      <ReportField label="Saldo pendente" value={formatCurrency(due)} />
    </ReportGrid>
  );
}

export function ServicesList({
  services
}: {
  services: Array<{ name: string; quantity: number; unit_price: string; total_price: string }>;
}) {
  if (services.length === 0) {
    return <EmptyState title="Sem serviços" description="Nenhum serviço foi vinculado a esta OS." />;
  }

  return (
    <div className="space-y-2">
      {services.map((service) => (
        <div
          key={`${service.name}-${service.quantity}-${service.total_price}`}
          className="grid gap-2 rounded-md border border-line bg-white p-3 md:grid-cols-[1fr_auto]"
        >
          <div>
            <p className="font-black text-ink">{service.name}</p>
            <p className="mt-1 text-sm text-muted">
              {service.quantity} peças x {formatCurrency(service.unit_price)}
            </p>
          </div>
          <p className="font-black text-ink md:text-right">{formatCurrency(service.total_price)}</p>
        </div>
      ))}
    </div>
  );
}

export function ReportItemsList({ items }: { items: ReportItem[] }) {
  if (items.length === 0) {
    return <EmptyState title="Sem itens" description="Nenhum item foi vinculado a esta OS." />;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={item.id} className="rounded-md border border-line bg-white p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                Item {index + 1}
              </p>
              <p className="mt-1 font-black text-ink">{item.product.name}</p>
              <p className="mt-1 text-sm text-muted">
                Tamanho {item.size.label} / {item.color || "Sem cor"}
              </p>
            </div>
            <p className="font-black text-ink">{item.quantity_requested} pecas</p>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            <ReportField label="Pecas destinadas" value={item.quantity_cut} />
            <ReportField label="Serigrafada" value={item.quantity_printed} />
            <ReportField label="Costurada" value={item.quantity_sewn} />
            <ReportField label="Entregue" value={item.quantity_delivered} />
          </div>
          <div className="mt-3">
            <ServicesList services={[...item.services, ...(item.outsourcing_services ?? [])]} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PaymentsList({
  payments,
  showNotes = false
}: {
  payments: Array<{ amount: string; payment_method: string; paid_at: string; notes?: string | null }>;
  showNotes?: boolean;
}) {
  if (payments.length === 0) {
    return <EmptyState title="Sem pagamentos" description="Nenhum pagamento foi lançado para esta OS." />;
  }

  return (
    <div className="space-y-2">
      {payments.map((payment) => (
        <div
          key={`${payment.amount}-${payment.payment_method}-${payment.paid_at}`}
          className="rounded-md border border-line bg-white p-3"
        >
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <p className="font-black text-ink">{formatCurrency(payment.amount)}</p>
            <p className="text-sm font-semibold text-muted">
              {payment.payment_method} / {formatDateTime(payment.paid_at)}
            </p>
          </div>
          {showNotes && payment.notes ? <p className="mt-2 text-sm text-muted">{payment.notes}</p> : null}
        </div>
      ))}
    </div>
  );
}
