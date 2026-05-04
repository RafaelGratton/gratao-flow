"use client";

import type { ReactNode } from "react";
import { Layers3 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

type Props = {
  title: string;
  description: string;
  count: number;
  loading: boolean;
  children: ReactNode;
};

export function ProductionSection({ title, description, count, loading, children }: Props) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-white/70">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-ink">{title}</h2>
            <p className="mt-1 text-sm font-semibold text-muted">{description}</p>
          </div>
          <span className="inline-flex h-8 items-center rounded-full border border-line bg-[#FCFAF6] px-3 text-xs font-black uppercase tracking-[0.12em] text-muted">
            {count} itens
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-lg border border-line bg-[#FCFAF6]" />
            ))}
          </div>
        ) : count === 0 ? (
          <EmptyState
            icon={<Layers3 size={20} />}
            title="Nenhuma ordem nesta etapa"
            description="Quando uma OS atender aos critérios desta fase, ela aparece aqui automaticamente."
          />
        ) : (
          <div className="space-y-3">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}
