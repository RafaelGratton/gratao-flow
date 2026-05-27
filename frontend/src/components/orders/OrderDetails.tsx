"use client";

import { ArrowLeft, CreditCard, Pause, Pencil, Play, ReceiptText, Undo2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PaymentModal } from "@/components/orders/PaymentModal";
import { OrderEditModal } from "@/components/orders/OrderEditModal";
import { ReturnCutPiecesModal } from "@/components/cutting/ReturnCutPiecesModal";
import { ProductionFlow } from "@/components/orders/ProductionFlow";
import { OrderReportsCard } from "@/components/orders/reports/OrderReportsCard";
import {
  financialLabels,
  financialTone,
  productionLabels,
  productionTone
} from "@/components/orders/status";
import { itemFlowLabel } from "@/components/production/helpers";
import type { OrderDetails as OrderDetailsType, OrderItem } from "@/components/orders/types";
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
  const [editOpen, setEditOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [productionControlLoading, setProductionControlLoading] = useState(false);
  const [returnTarget, setReturnTarget] = useState<OrderItem | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  async function handleProductionControl() {
    if (!order) return;
    const pausing = !order.production_paused;
    const confirmed = window.confirm(
      pausing
        ? 'Pausar a producao impede novos avancos nesta OS. Pecas ja destinadas nao retornam automaticamente ao estoque. Use "Devolver ao estoque" caso precise redireciona-las.'
        : "Deseja retomar a producao desta OS?"
    );
    if (!confirmed) return;

    setProductionControlLoading(true);
    setActionError(null);
    setSuccess(null);
    try {
      const updated = await api.post<OrderDetailsType>(
        `/orders/${order.id}/${pausing ? "pause-production" : "resume-production"}`
      );
      setOrder(updated);
      setSuccess(pausing ? "Producao pausada." : "Producao retomada.");
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel atualizar a producao da OS."
      );
    } finally {
      setProductionControlLoading(false);
    }
  }

  function handlePiecesReturned(updated: OrderDetailsType) {
    setOrder(updated);
    setSuccess("Pecas devolvidas ao estoque com sucesso.");
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
              : `${order.items[0]?.product.name ?? "-"} / ${order.items[0]?.size.label ?? "-"} / ${order.items[0]?.color ?? "-"}`}
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
          {order.production_paused ? (
            <StatusBadge label="Producao pausada" status="warning" />
          ) : null}
          <Button
            type="button"
            variant="secondary"
            onClick={handleProductionControl}
            isLoading={productionControlLoading}
            disabled={["cancelled", "delivered"].includes(order.production_status)}
          >
            {order.production_paused ? <Play size={18} /> : <Pause size={18} />}
            {order.production_paused ? "Retomar producao" : "Pausar producao"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil size={18} />
            Editar OS
          </Button>
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
        {success ? (
          <div className="rounded-md border border-success/20 bg-success/10 p-4 text-sm font-semibold text-success xl:col-span-3">
            {success}
          </div>
        ) : null}
        {order.production_paused ? (
          <div className="rounded-md border border-warning/20 bg-warning/5 p-4 text-sm font-semibold text-muted xl:col-span-3">
            Producao pausada. Pecas destinadas permanecem na OS ate uma devolucao manual ao estoque.
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
                        {itemFlowLabel(item)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="text-sm font-black text-ink">
                        {formatCurrency(
                          item.services
                            .reduce((total, service) => total + Number(service.total_price), 0)
                            .toFixed(2)
                        )}
                      </p>
                      {item.quantity_cut > 0 ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setReturnTarget(item)}
                          disabled={["cancelled", "delivered"].includes(order.production_status)}
                        >
                          <Undo2 size={16} />
                          Devolver ao estoque
                        </Button>
                      ) : null}
                    </div>
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
          <p className="mt-1 text-sm text-muted">Destinacao de corte, serigrafia e confeccao com progresso por quantidade.</p>
        </CardHeader>
        <CardContent>
          <ProductionFlow order={order} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-black text-ink">Historico operacional</h2>
          <p className="mt-1 text-sm text-muted">Eventos por item com usuario, data, etapa, motivo e observacao.</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {buildOperationalHistory(order).length === 0 ? (
              <p className="text-sm font-semibold text-muted">Sem movimentacoes registradas.</p>
            ) : (
              buildOperationalHistory(order).map((entry) => (
                <div key={entry.key} className="rounded-md border border-line bg-[#FCFAF6] p-3 text-sm">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <p className="font-black text-ink">{entry.label}</p>
                    <p className="text-xs font-semibold text-muted">{formatDateTime(entry.at)}</p>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-muted">
                    {entry.itemLabel === "OS" ? "OS" : `Item ${entry.itemLabel}`} / qtd. {entry.quantity ?? "-"} / usuario {entry.user}
                  </p>
                  {entry.reason ? <p className="mt-2 text-xs font-bold text-warning">Motivo: {entry.reason}</p> : null}
                  {entry.notes ? <p className="mt-1 text-xs text-muted">Obs.: {entry.notes}</p> : null}
                  {entry.beforeAfter ? <p className="mt-1 text-xs text-muted">{entry.beforeAfter}</p> : null}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <PaymentModal
        orderId={order.id}
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onUpdated={setOrder}
      />
      <OrderEditModal
        order={order}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onUpdated={setOrder}
      />
      <ReturnCutPiecesModal
        order={order}
        item={returnTarget}
        open={Boolean(returnTarget)}
        onClose={() => setReturnTarget(null)}
        onUpdated={handlePiecesReturned}
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

function buildOperationalHistory(order: OrderDetailsType) {
  const itemLabel = (itemId: number | null) => {
    const index = order.items.findIndex((item) => item.id === itemId);
    return index >= 0 ? String(index + 1) : "OS";
  };
  const production = order.production_events
    .filter(
      (event) =>
        event.event_type !== "delivery_registered" &&
        (event.order_item_id !== null ||
          ["production_paused", "production_resumed"].includes(event.event_type))
    )
    .map((event) => ({
      key: `event-${event.id}`,
      label: eventLabel(event.event_type),
      itemLabel: itemLabel(event.order_item_id),
      quantity: event.quantity,
      user: event.user_name_snapshot ?? "nao registrado",
      reason: event.reason,
      notes: event.notes,
      beforeAfter:
        event.before_quantity !== null || event.after_quantity !== null
          ? `Antes: ${event.before_quantity ?? "-"} / Depois: ${event.after_quantity ?? "-"}`
          : null,
      at: event.created_at
    }));
  const deliveries = order.items.flatMap((item, index) =>
    item.delivery_history.map((entry) => ({
      key: `delivery-${entry.id}`,
      label: "Entrega registrada",
      itemLabel: String(index + 1),
      quantity: entry.quantity,
      user: entry.user_name_snapshot ?? entry.responsible,
      reason: null,
      notes: entry.delivery_notes ?? entry.notes,
      beforeAfter: entry.picked_up_by
        ? `Retirado por: ${entry.picked_up_by} / ${entry.pickup_document ?? "sem documento"}`
        : null,
      at: entry.delivered_at
    }))
  );
  return [...production, ...deliveries].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );
}

function eventLabel(eventType: string) {
  if (eventType === "cut_registered") return "Corte registrado no estoque";
  if (eventType === "cut_pieces_allocated") return "Pecas cortadas destinadas a OS";
  if (eventType === "cut_pieces_returned") return "Pecas cortadas devolvidas ao estoque";
  if (eventType === "production_paused") return "Producao pausada";
  if (eventType === "production_resumed") return "Producao retomada";
  if (eventType === "print_registered") return "DTF/serigrafia registrada";
  if (eventType === "sewing_registered") return "Confeccao registrada";
  if (eventType === "outsourcing_sent") return "Terceirizacao enviada";
  if (eventType === "outsourcing_returned") return "Retorno de terceirizacao";
  if (eventType === "delivery_registered") return "Entrega registrada";
  if (eventType === "loss_registered") return "Perda registrada";
  if (eventType === "rework_registered") return "Retrabalho registrado";
  if (eventType === "adjustment_registered") return "Ajuste operacional";
  if (eventType === "status_changed") return "Status alterado";
  return eventType;
}
