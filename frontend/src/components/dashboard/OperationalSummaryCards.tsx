import {
  AlertTriangle,
  CirclePause,
  Factory,
  PackageCheck,
  Scissors,
  Truck
} from "lucide-react";
import type { OperationalSummary } from "@/components/dashboard/types";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatNumber } from "@/lib/format";

export function OperationalSummaryCards({
  summary,
  loading
}: {
  summary: OperationalSummary | null;
  loading: boolean;
}) {
  const cards = [
    {
      label: "OS ativas",
      value: summary?.activeOrders,
      detail: "Não canceladas nem entregues.",
      icon: <Factory size={21} />,
      href: "/production"
    },
    {
      label: "Urgentes / críticas",
      value: summary?.urgentOrders,
      detail: "OS ativas com item prioritario.",
      icon: <AlertTriangle size={21} />,
      href: "/production"
    },
    {
      label: "Produção pausada",
      value: summary?.pausedOrders,
      detail: "OS ativas suspensas.",
      icon: <CirclePause size={21} />,
      href: "/production"
    },
    {
      label: "Prontas para entrega",
      value: summary?.readyDeliveries,
      detail: "Itens prontos para retirada.",
      icon: <Truck size={21} />,
      href: "/deliveries"
    },
    {
      label: "Peças cortadas disponíveis",
      value: summary?.freeCutPieces,
      detail: "Saldo livre no estoque de peças.",
      icon: <Scissors size={21} />,
      href: "/stock"
    },
    {
      label: "Gargalos",
      value: summary?.bottleneckOrders,
      detail: "OS com alerta operacional.",
      icon: <PackageCheck size={21} />,
      href: "/production"
    }
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => (
        <StatCard
          key={card.label}
          label={card.label}
          value={loading || card.value === undefined ? "--" : formatNumber(card.value)}
          detail={card.detail}
          icon={card.icon}
          href={card.href}
          className={loading ? "animate-pulse" : undefined}
        />
      ))}
    </section>
  );
}
