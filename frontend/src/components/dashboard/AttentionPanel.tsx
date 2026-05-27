import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { AttentionAlert } from "@/components/dashboard/types";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export function AttentionPanel({
  alerts,
  loading
}: {
  alerts: AttentionAlert[];
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
          Prioridades operacionais
        </p>
        <h2 className="mt-1 text-xl font-black text-ink">Atenções de hoje</h2>
      </CardHeader>
      <CardContent>
        {loading ? (
          <PanelSkeleton rows={4} />
        ) : alerts.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle size={20} />}
            title="Nenhuma atenção prioritária"
            description="Não há urgências, pausas com peças destinadas ou alertas de entrega em aberto."
            className="min-h-36"
          />
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <article
                key={alert.key}
                className="grid gap-3 rounded-lg border border-line bg-[#FCFAF6] p-4 lg:grid-cols-[1fr_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={alert.badgeTone}>{alert.badge}</Badge>
                    <p className="text-sm font-black text-ink">{alert.title}</p>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-muted">{alert.detail}</p>
                  {alert.metrics ? <p className="mt-2 text-sm font-black text-ink">{alert.metrics}</p> : null}
                  <p className="mt-1 text-sm text-muted">{alert.message}</p>
                </div>
                <Link
                  href={alert.href}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-ink shadow-insetline transition hover:bg-accent-soft/70 focus:focus-ring"
                >
                  {alert.action}
                  <ArrowRight size={15} />
                </Link>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-24 animate-pulse rounded-lg border border-line bg-[#FCFAF6]" />
      ))}
    </div>
  );
}
