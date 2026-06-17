"use client";

import { LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { clearToken } from "@/lib/auth";

const titles: Record<string, { title: string; eyebrow: string }> = {
  "/dashboard": { title: "Visão Geral", eyebrow: "Resumo operacional da produção" },
  "/orders": { title: "Ordens de Serviço", eyebrow: "Cadastro e acompanhamento" },
  "/clients": { title: "Clientes", eyebrow: "Carteira de atendimento" },
  "/production": { title: "Produção", eyebrow: "Fluxo de corte, DTF e confecção" },
  "/printing": { title: "DTF", eyebrow: "Controle de impressão" },
  "/outsourcing": { title: "Terceirização", eyebrow: "Controle de saídas e retornos" },
  "/stock": { title: "Estoque", eyebrow: "Peças, movimentos e saldos" },
  "/finance": { title: "Financeiro", eyebrow: "Recebimentos e fechamentos" },
  "/employees": { title: "Funcionários", eyebrow: "Equipe e diárias" },
  "/reports": { title: "Relatórios", eyebrow: "Análises da operação" },
  "/settings": { title: "Configurações", eyebrow: "Parâmetros do sistema" }
};

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const current = titles[pathname] ?? titles["/dashboard"];

  function logout() {
    clearToken();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-10 border-b border-line/75 bg-white/86 px-5 py-4 backdrop-blur xl:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent-dark">
            {current.eyebrow}
          </p>
          <h1 className="mt-1 text-2xl font-black text-ink">{current.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-bold text-ink">Gratão Uniformes</p>
            <p className="text-xs text-muted">Administração</p>
          </div>
          <Button variant="secondary" onClick={logout} className="h-10 px-3" title="Sair">
            <LogOut size={17} />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
