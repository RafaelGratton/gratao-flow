import { Construction } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";

type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-dark">
                Área operacional
              </p>
              <h2 className="mt-1 text-xl font-black text-ink">{title}</h2>
            </div>
            <StatusBadge label="Em organização" status="warning" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="max-w-3xl text-sm leading-7 text-muted">{description}</p>
        </CardContent>
      </Card>

      <EmptyState
        icon={<Construction size={20} />}
        title="Área em organização"
        description="Esta seção está preparada para evoluir com os próximos processos da operação."
      />
    </div>
  );
}
