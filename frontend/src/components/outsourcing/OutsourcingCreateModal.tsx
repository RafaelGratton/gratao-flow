"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { OrderDetails, OrderItem, Outsourcer } from "@/components/orders/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

type Props = {
  order: OrderDetails | null;
  item: OrderItem | null;
  availableQuantity: number;
  outsourcers: Outsourcer[];
  open: boolean;
  onClose: () => void;
  onCreated: (order: OrderDetails) => void;
  onQuickCreate: () => void;
};

export function OutsourcingCreateModal({
  order,
  item,
  availableQuantity,
  outsourcers,
  open,
  onClose,
  onCreated,
  onQuickCreate
}: Props) {
  const [outsourcerId, setOutsourcerId] = useState("");
  const [quantitySent, setQuantitySent] = useState("");
  const [customerUnitPrice, setCustomerUnitPrice] = useState("");
  const [outsourcerUnitPrice, setOutsourcerUnitPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paused = Boolean(order?.production_paused);

  useEffect(() => {
    if (open) {
      setOutsourcerId("");
      setQuantitySent("");
      setCustomerUnitPrice("");
      setOutsourcerUnitPrice("");
      setNotes("");
      setError(null);
    }
  }, [open, order?.id, item?.id]);

  const totals = useMemo(() => {
    const quantity = Number(quantitySent);
    const customer = Number(customerUnitPrice);
    const payout = Number(outsourcerUnitPrice);
    return {
      customer: quantity * customer,
      payout: quantity * payout,
      profit: quantity * (customer - payout)
    };
  }, [quantitySent, customerUnitPrice, outsourcerUnitPrice]);

  const validation = useMemo(() => {
    const quantity = Number(quantitySent);
    const customer = Number(customerUnitPrice);
    const payout = Number(outsourcerUnitPrice);
    if (paused) return "A producao desta OS esta pausada. Retome a OS antes de enviar para terceirizacao.";
    if (!quantitySent || !customerUnitPrice || !outsourcerUnitPrice) return null;
    if (!Number.isInteger(quantity) || quantity <= 0) return "Informe uma quantidade inteira maior que zero.";
    if (quantity > availableQuantity) return `Quantidade disponivel: ${availableQuantity}.`;
    if (customer < 0 || payout < 0) return "Valores devem ser maiores ou iguais a zero.";
    return null;
  }, [availableQuantity, customerUnitPrice, outsourcerUnitPrice, paused, quantitySent]);

  if (!open || !order || !item) return null;

  async function submit() {
    if (!order || !item || validation) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await api.post<OrderDetails>(`/orders/${order.id}/outsourcing`, {
        order_item_id: item.id,
        outsourcer_id: outsourcerId ? Number(outsourcerId) : null,
        quantity_sent: Number(quantitySent),
        customer_unit_price: customerUnitPrice || "0",
        outsourcer_unit_price: outsourcerUnitPrice,
        return_expected: true,
        direct_to_customer: false,
        notes: notes || null
      });
      onCreated(updated);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível enviar para terceirização.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-dark">OS #{order.id}</p>
            <h2 className="text-lg font-black text-ink">Enviar para terceirização</h2>
            <p className="mt-1 text-sm font-semibold text-muted">{item.product.name} / {item.size.label} / {item.color}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md text-muted transition hover:bg-[#FCFAF6] hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 p-5">
          {error ? <div className="rounded-md border border-danger/20 bg-danger/10 p-3 text-sm font-semibold text-danger">{error}</div> : null}
          {paused ? (
            <div className="rounded-md border border-warning/25 bg-warning/10 p-3 text-sm font-semibold text-warning">
              Producao pausada. Retome a OS para enviar pecas para terceirizacao.
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-ink">Terceirizado</span>
              <select className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring" value={outsourcerId} onChange={(event) => setOutsourcerId(event.target.value)}>
                <option value="">Sem terceirizado definido</option>
                {outsourcers.map((outsourcer) => (
                  <option key={outsourcer.id} value={outsourcer.id}>{outsourcer.name}</option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <Button type="button" variant="secondary" className="w-full" onClick={onQuickCreate}>Cadastrar terceirizado</Button>
            </div>
            <Input label={`Quantidade enviada (destinada/processada disponivel: ${availableQuantity})`} type="number" min="1" max={availableQuantity} step="1" value={quantitySent} onChange={(event) => setQuantitySent(event.target.value)} />
            <div>
              <Input label="Preco vendido na OS por peca (referencia)" type="number" min="0" step="0.01" value={customerUnitPrice} onChange={(event) => setCustomerUnitPrice(event.target.value)} />
              <p className="mt-1 text-xs font-semibold text-muted">Este valor entra no total cobrado da OS.</p>
            </div>
            <Input label="Custo terceirizado por peca" type="number" min="0" step="0.01" value={outsourcerUnitPrice} onChange={(event) => setOutsourcerUnitPrice(event.target.value)} />
            <div className="rounded-md border border-line bg-[#FCFAF6] p-3 text-sm font-semibold text-muted">
              Fluxo: retorna para a Gratao antes da entrega ao cliente.
            </div>
          </div>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Observacoes</span>
            <textarea className="min-h-24 w-full rounded-md border border-line bg-white px-3 py-3 text-sm text-ink shadow-insetline transition focus:focus-ring" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <div className="grid gap-3 rounded-md border border-line bg-[#FCFAF6] p-4 md:grid-cols-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Referencia OS</p><p className="mt-1 text-lg font-black text-ink">{formatCurrency(totals.customer)}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Custo terceirizado</p><p className="mt-1 text-lg font-black text-warning">{formatCurrency(totals.payout)}</p></div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Resultado ref.</p>
              <p className={`mt-1 text-lg font-black ${totals.profit < 0 ? "text-danger" : "text-success"}`}>{formatCurrency(totals.profit)}</p>
            </div>
          </div>
          {validation ? <p className="text-sm font-semibold text-danger">{validation}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="button" isLoading={loading} disabled={paused || !quantitySent || !customerUnitPrice || !outsourcerUnitPrice || Boolean(validation)} onClick={submit}>Enviar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
