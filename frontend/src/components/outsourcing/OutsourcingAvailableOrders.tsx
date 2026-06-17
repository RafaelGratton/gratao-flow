"use client";

import { ChevronDown, ChevronRight, Send } from "lucide-react";
import { useMemo, useState } from "react";
import type { OrderDetails, OrderItem } from "@/components/orders/types";
import { priorityLabel } from "@/components/production/helpers";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export type AvailableOutsourcingItem = {
  order: OrderDetails;
  item: OrderItem;
  availableQuantity: number;
};

type Props = {
  items: AvailableOutsourcingItem[];
  loading: boolean;
  onSend: (target: AvailableOutsourcingItem) => void;
};

type OutsourcingOrderGroup = {
  order: OrderDetails;
  items: AvailableOutsourcingItem[];
  totalAvailable: number;
  products: string[];
  priority: OrderItem["operational_priority"];
};

const priorityRank = {
  critical: 0,
  urgent: 1,
  normal: 2
};

function outsourcingFlowLabel(item: OrderItem) {
  return [
    "Destinacao",
    item.services.some((service) => service.service.type === "serigrafia") ? "DTF" : null,
    "Terceirizacao"
  ]
    .filter(Boolean)
    .join(" -> ");
}

export function OutsourcingAvailableOrders({ items, loading, onSend }: Props) {
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(() => new Set());

  const orderGroups = useMemo<OutsourcingOrderGroup[]>(() => {
    const grouped = new Map<number, AvailableOutsourcingItem[]>();

    items.forEach((target) => {
      const groupItems = grouped.get(target.order.id) ?? [];
      groupItems.push(target);
      grouped.set(target.order.id, groupItems);
    });

    return Array.from(grouped.values())
      .map((groupItems) => {
        const sortedItems = [...groupItems].sort((a, b) => {
          const priorityDiff = priorityRank[a.item.operational_priority] - priorityRank[b.item.operational_priority];
          if (priorityDiff !== 0) return priorityDiff;
          return b.availableQuantity - a.availableQuantity || a.item.id - b.item.id;
        });
        const priority = sortedItems.reduce(
          (highest, target) =>
            priorityRank[target.item.operational_priority] < priorityRank[highest]
              ? target.item.operational_priority
              : highest,
          sortedItems[0].item.operational_priority
        );

        return {
          order: sortedItems[0].order,
          items: sortedItems,
          totalAvailable: sortedItems.reduce((total, target) => total + target.availableQuantity, 0),
          products: Array.from(new Set(sortedItems.map((target) => target.item.product.name))),
          priority
        };
      })
      .sort((a, b) => {
        if (b.items.length !== a.items.length) return b.items.length - a.items.length;
        if (b.totalAvailable !== a.totalAvailable) return b.totalAvailable - a.totalAvailable;

        const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
        if (priorityDiff !== 0) return priorityDiff;

        return a.order.id - b.order.id;
      });
  }, [items]);

  function toggleOrder(orderId: number) {
    setExpandedOrders((current) => {
      const next = new Set(current);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-white/70">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Disponiveis</p>
          <h2 className="mt-1 text-xl font-black text-ink">Itens prontos para terceirizacao</h2>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Send size={20} />}
            title="Nenhum item disponivel"
            description="Itens terceirizados com pecas cortadas destinadas e DTF concluido, quando houver, aparecem aqui para envio."
          />
        ) : (
          <div className="grid gap-3">
            {orderGroups.map((group) => (
              <OutsourcingOrderCard
                key={group.order.id}
                group={group}
                expanded={expandedOrders.has(group.order.id)}
                onToggle={() => toggleOrder(group.order.id)}
                onSend={onSend}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OutsourcingOrderCard({
  group,
  expanded,
  onToggle,
  onSend
}: {
  group: OutsourcingOrderGroup;
  expanded: boolean;
  onToggle: () => void;
  onSend: (target: AvailableOutsourcingItem) => void;
}) {
  const itemLabel = group.items.length === 1 ? "item disponivel" : "itens disponiveis";

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white shadow-insetline">
      <div className="grid gap-4 p-4 lg:grid-cols-[1.1fr_1fr_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-black text-ink">OS #{group.order.id}</span>
            <Badge tone="accent">
              {group.items.length} {itemLabel}
            </Badge>
            <PriorityBadge priority={group.priority} />
            {group.order.production_paused ? <Badge tone="warning">Producao pausada</Badge> : null}
          </div>
          <p className="mt-1 text-sm font-semibold text-muted">{group.order.client.name}</p>
          <p className="mt-3 truncate text-sm text-muted">
            Produtos: <span className="font-bold text-ink">{group.products.join(", ")}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Metric label="Itens disponiveis" value={group.items.length} />
          <Metric label="Total disponivel" value={group.totalAvailable} suffix=" pecas" />
        </div>

        <Button type="button" variant="secondary" onClick={onToggle} aria-expanded={expanded}>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          Ver itens
        </Button>
      </div>

      {expanded ? (
        <div className="border-t border-line/70 bg-[#FCFAF6]/70 p-4">
          <div className="grid gap-3">
            {group.items.map((target) => (
              <OutsourcingItemRow
                key={`${target.order.id}-${target.item.id}`}
                target={target}
                onSend={() => onSend(target)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OutsourcingItemRow({
  target,
  onSend
}: {
  target: AvailableOutsourcingItem;
  onSend: () => void;
}) {
  const paused = target.order.production_paused;
  return (
    <div className="grid gap-4 rounded-md border border-line bg-white p-4 lg:grid-cols-[1fr_1fr_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">Item</Badge>
          {target.availableQuantity <= 0 ? <Badge tone="warning">Sem saldo</Badge> : null}
          {paused ? <Badge tone="warning">Producao pausada</Badge> : null}
        </div>
        <p className="mt-2 text-sm text-muted">
          <span className="font-bold text-ink">{target.item.product.name}</span> / {target.item.size.label} / {target.item.color || "sem cor"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Disponivel para envio" value={target.availableQuantity} />
        <div className="rounded-md border border-line bg-[#FCFAF6] p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Fluxo</p>
          <p className="mt-1 text-sm font-black text-ink">{outsourcingFlowLabel(target.item)}</p>
        </div>
      </div>

      <Button type="button" disabled={target.availableQuantity <= 0 || paused} onClick={onSend}>
        <Send size={16} />
        {paused ? "Producao pausada" : "Enviar"}
      </Button>
    </div>
  );
}

function Metric({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-md border border-line bg-[#FCFAF6] p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className="mt-1 text-xl font-black text-ink">
        {value}
        {suffix}
      </p>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: OrderItem["operational_priority"] }) {
  const tone = priority === "critical" ? "danger" : priority === "urgent" ? "warning" : "neutral";
  return <Badge tone={tone}>{priorityLabel(priority)}</Badge>;
}
