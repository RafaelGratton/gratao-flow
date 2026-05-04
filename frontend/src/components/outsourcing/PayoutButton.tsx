"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import type { OrderDetails } from "@/components/orders/types";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";

type Props = {
  orderId: number;
  outsourcingId: number;
  disabled?: boolean;
  onPaid: (order: OrderDetails) => void;
  onError: (message: string) => void;
};

export function PayoutButton({ orderId, outsourcingId, disabled, onPaid, onError }: Props) {
  const [loading, setLoading] = useState(false);

  async function pay() {
    setLoading(true);
    try {
      const updated = await api.post<OrderDetails>(`/orders/${orderId}/outsourcing/${outsourcingId}/payout`, {});
      onPaid(updated);
    } catch (requestError) {
      onError(requestError instanceof Error ? requestError.message : "Nao foi possivel marcar repasse como pago.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="secondary" className="h-10 px-3" isLoading={loading} disabled={disabled} onClick={pay}>
      <CheckCircle2 size={16} />
      Pagar repasse
    </Button>
  );
}
