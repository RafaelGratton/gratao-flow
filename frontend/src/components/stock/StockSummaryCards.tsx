import { AlertTriangle, Boxes, Package, Shirt } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import type { StockItem } from "./types";

type Props = {
  items: StockItem[];
};

export function StockSummaryCards({ items }: Props) {
  const materials = items.filter((item) => item.category === "material").length;
  const pieces = items.filter((item) => item.category === "piece").length;
  const lowOrEmpty = items.filter((item) => Number(item.quantity) <= 0).length;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Total de itens"
        value={items.length}
        detail="Itens cadastrados para controle operacional."
        icon={<Boxes size={20} />}
      />
      <StatCard
        label="Materiais"
        value={materials}
        detail="Malhas, insumos e materiais de consumo."
        icon={<Package size={20} />}
      />
      <StatCard
        label="Pecas"
        value={pieces}
        detail="Produtos por tamanho e cor."
        icon={<Shirt size={20} />}
      />
      <StatCard
        label="Baixo ou zerado"
        value={lowOrEmpty}
        detail="Itens que precisam de atencao."
        icon={<AlertTriangle size={20} />}
      />
    </div>
  );
}
