"use client";

import { ArrowLeft, CreditCard, ReceiptText, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PaymentModal } from "@/components/orders/PaymentModal";
import { ProductionFlow } from "@/components/orders/ProductionFlow";
import { OrderReportsCard } from "@/components/orders/reports/OrderReportsCard";
import {
  financialLabels,
  financialTone,
  productionFlowLabels,
  productionLabels,
  productionTone
} from "@/components/orders/status";
import type { OrderDetails as OrderDetailsType } from "@/components/orders/types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";

type OrderDetailsProps = {
  orderId: number;
};

export function OrderDetails({ orderId }: OrderDetailsProps) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetailsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadOrder() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<OrderDetailsType>(`/orders/${orderId}`);
        if (active) {
          setOrder(data);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error ? requestError.message : "Não foi possível carregar a OS."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadOrder();

    return () => {
      active = false;
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-lg border border-line bg-white/80" />
        ))}
      </div>
    );
  }

  if (error || order === null) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            title="Não foi possível abrir a OS"
            description={error ?? "A ordem solicitada não foi encontrada."}
          />
        </CardContent>
      </Card>
    );
  }

  async function handleCancelOrder() {
    if (!order) return;
    const confirmed = window.confirm(
      "Essa ação remove/cancela a ordem da operação. Deseja continuar?"
    );
    if (!confirmed) return;

    setCancelling(true);
    setActionError(null);
    try {
      await api.delete(`/orders/${order.id}`);
      router.push("/orders");
    } catch (requestError) {
      setActionError(
        requestError instanceof Error ? requestError.message : "Nao foi possivel cancelar a OS."
      );
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-lg border border-line bg-white/90 p-5 shadow-soft md:flex-row md:items-center md:justify-between">
        <div>
          <Link
            href="/orders"
            className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-muted transition hover:text-ink"
          >
            <ArrowLeft size={16} />
            Voltar para OS
          </Link>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
            Ordem de serviço #{order.id}
          </p>
          <h1 className="mt-1 text-2xl font-black text-ink">{order.client.name}</h1>
          <p className="mt-2 text-sm font-semibold text-muted">
            {order.items.length > 1
              ? `${order.items.length} itens nesta OS`
              : `${order.product.name} / ${order.size.label} / ${order.color}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge
            label={productionLabels[order.production_status]}
            status={productionTone(order.production_status)}
          />
          <StatusBadge
            label={financialLabels[order.financial_status]}
            status={financialTone(order.financial_status)}
          />
          <Button
            type="button"
            variant="ghost"
            className="text-danger hover:text-danger"
            onClick={handleCancelOrder}
            isLoading={cancelling}
            disabled={order.production_status === "cancelled"}
          >
            <XCircle size={18} />
            Cancelar OS
          </Button>
        </div>
      </div>

      <section className="grid gap-5 xl:grid-cols-3">
        {actionError ? (
          <div className="rounded-md border border-danger/20 bg-danger/10 p-4 text-sm font-semibold text-danger xl:col-span-3">
            {actionError}
          </div>
        ) : null}
        <FinancialCard label="Total" value={order.total_amount} />
        <FinancialCard label="Pago" value={order.amount_paid} />
        <FinancialCard label="A receber" value={order.amount_due} emphasis />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-black text-ink">Itens</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.items.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-md border border-line bg-[#FCFAF6] p-4"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent-dark">
                        Item {index + 1}
                      </p>
                      <p className="mt-1 font-black text-ink">{item.product.name}</p>
                      <p className="mt-1 text-sm font-semibold text-muted">
                        Tamanho {item.size.label} / {item.color || "Sem cor"} /{" "}
                        {item.quantity_requested} pecas
                      </p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-accent-dark">
                        {productionFlowLabels[item.production_flow]}
                      </p>
                    </div>
                    <p className="text-sm font-black text-ink">
                      {formatCurrency(
                        item.services
                          .reduce((total, service) => total + Number(service.total_price), 0)
                          .toFixed(2)
                      )}
                    </p>
                  </div>
                  <div className="mt-4 space-y-2">
                    {item.services.map((service) => (
                      <div
                        key={service.id}
                        className="grid gap-2 rounded-md border border-line/80 bg-white p-3 md:grid-cols-[1fr_auto]"
                      >
                        <div>
                          <p className="font-bold text-ink">{service.service.name}</p>
                          <p className="mt-1 text-sm text-muted">
                            {service.quantity} pecas x {formatCurrency(service.unit_price)}
                          </p>
                        </div>
                        <p className="text-right font-black text-ink">
                          {formatCurrency(service.total_price)}
                        </p>
                      </div>
                    ))}
                  </div>
                  {item.notes ? (
                    <p className="mt-3 text-sm font-semibold text-muted">{item.notes}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-ink">Pagamentos</h2>
                <p className="mt-1 text-sm text-muted">Lançamentos acumulativos e parciais.</p>
              </div>
              <Button type="button" variant="secondary" onClick={() => setPaymentOpen(true)}>
                <CreditCard size={18} />
                Adicionar pagamento
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {order.payments.length === 0 ? (
              <EmptyState
                icon={<ReceiptText size={20} />}
                title="Nenhum pagamento lançado"
                description="Registre pagamentos parciais ou totais desta ordem."
              />
            ) : (
              <div className="space-y-3">
                {order.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between rounded-md border border-line bg-[#FCFAF6] p-4"
                  >
                    <div>
                      <p className="font-black text-ink">{formatCurrency(payment.amount)}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                        {payment.payment_method}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-muted">{formatDateTime(payment.paid_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <OrderReportsCard orderId={order.id} />

      <Card>
        <CardHeader>
          <h2 className="text-lg font-black text-ink">Produção</h2>
          <p className="mt-1 text-sm text-muted">Corte, serigrafia e confecção com progresso por quantidade.</p>
        </CardHeader>
        <CardContent>
          <ProductionFlow order={order} />
        </CardContent>
      </Card>

      <PaymentModal
        orderId={order.id}
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onUpdated={setOrder}
      />
    </div>
  );
}

function FinancialCard({
  label,
  value,
  emphasis = false
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <Card className={emphasis ? "border-accent/35 bg-accent-soft/35" : undefined}>
      <CardContent>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">{label}</p>
        <p className="mt-3 text-3xl font-black text-ink">{formatCurrency(value)}</p>
      </CardContent>
    </Card>
  );
}
