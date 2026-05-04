"use client";

import {
  ClipboardList,
  Layers3,
  PackageCheck,
  Users,
  WalletCards
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api";
import { formatNumber, pluralize } from "@/lib/format";

type DashboardData = {
  products: unknown[];
  sizes: unknown[];
  services: unknown[];
  orders: unknown[];
  stockItems: unknown[];
  employees: unknown[];
  weeklyClosings: unknown[];
};

const initialData: DashboardData = {
  products: [],
  sizes: [],
  services: [],
  orders: [],
  stockItems: [],
  employees: [],
  weeklyClosings: []
};

const flow = [
  { label: "Corte", status: "active" as const },
  { label: "Serigrafia", status: "idle" as const },
  { label: "Confecção", status: "idle" as const },
  { label: "Terceirização", status: "idle" as const },
  { label: "Entrega", status: "idle" as const }
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [products, sizes, services, orders, stockItems, employees, weeklyClosings] =
          await Promise.all([
            api.get<unknown[]>("/products"),
            api.get<unknown[]>("/sizes"),
            api.get<unknown[]>("/services"),
            api.get<unknown[]>("/orders"),
            api.get<unknown[]>("/stock/items"),
            api.get<unknown[]>("/employees"),
            api.get<unknown[]>("/weekly-closings")
          ]);

        if (active) {
          setData({ products, sizes, services, orders, stockItems, employees, weeklyClosings });
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Nao foi possivel carregar o dashboard."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(
    () => [
      {
        label: "Ordens cadastradas",
        value: data.orders.length,
        detail: `${formatNumber(data.orders.length)} ${pluralize(data.orders.length, "ordem operacional registrada", "ordens operacionais registradas")}.`,
        icon: <ClipboardList size={21} />
      },
      {
        label: "Itens de estoque",
        value: data.stockItems.length,
        detail: "Itens operacionais disponíveis para consulta e movimentação.",
        icon: <PackageCheck size={21} />
      },
      {
        label: "Funcionários",
        value: data.employees.length,
        detail: "Equipe registrada para acompanhamento da produção.",
        icon: <Users size={21} />
      },
      {
        label: "Fechamentos",
        value: data.weeklyClosings.length,
        detail: "Fechamentos operacionais registrados para controle financeiro.",
        icon: <WalletCards size={21} />
      }
    ],
    [data]
  );

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger/10 p-4 text-sm font-semibold text-danger">
          {error}
        </div>
      ) : null}

      <section>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
          Gratão Uniformes
        </p>
        <h2 className="mt-2 text-3xl font-black text-ink">Visão Geral</h2>
        <p className="mt-2 text-sm font-medium text-muted">Resumo operacional da produção</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={loading ? "..." : stat.value}
            detail={stat.detail}
            icon={stat.icon}
          />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
                  Fluxo de produção
                </p>
                <h2 className="mt-1 text-lg font-black text-ink">Etapas da operação</h2>
              </div>
              <StatusBadge label="Em acompanhamento" status="active" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-5">
              {flow.map((step, index) => (
                <div
                  key={step.label}
                  className="relative rounded-lg border border-line bg-[#FFFDF8] p-4"
                >
                  <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-md bg-white text-accent-dark shadow-insetline">
                    {index + 1}
                  </div>
                  <p className="font-bold text-ink">{step.label}</p>
                  <div className="mt-3">
                    <StatusBadge
                      label={step.status === "active" ? "Pronto para dados" : "Aguardando"}
                      status={step.status}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
              Configurações base
            </p>
            <h2 className="mt-1 text-lg font-black text-ink">Catálogos do sistema</h2>
          </CardHeader>
          <CardContent>
            {loading ? (
              <EmptyState
                title="Carregando dados"
                description="Atualizando configurações de produtos, tamanhos e serviços."
              />
            ) : (
              <div className="space-y-3">
                {[
                  ["Produtos", data.products.length],
                  ["Tamanhos", data.sizes.length],
                  ["Serviços", data.services.length]
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-md border border-line bg-[#FFFDF8] px-4 py-3"
                  >
                    <span className="text-sm font-semibold text-muted">{label}</span>
                    <span className="text-lg font-black text-ink">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardContent>
          <EmptyState
            icon={<Layers3 size={20} />}
            title="Acompanhamento operacional"
            description="Use o menu lateral para acessar ordens, produção, estoque, financeiro e relatórios."
          />
        </CardContent>
      </Card>
    </div>
  );
}
