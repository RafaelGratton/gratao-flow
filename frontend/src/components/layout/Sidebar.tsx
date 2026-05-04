"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  BarChart3,
  Boxes,
  ClipboardList,
  Factory,
  Home,
  Settings,
  Stamp,
  Truck,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Ordens de Serviço", href: "/orders", icon: ClipboardList },
  { label: "Clientes", href: "/clients", icon: Users },
  { label: "Produção", href: "/production", icon: Factory },
  { label: "Serigrafia", href: "/printing", icon: Stamp },
  { label: "Terceirização", href: "/outsourcing", icon: Truck },
  { label: "Estoque", href: "/stock", icon: Boxes },
  { label: "Financeiro", href: "/finance", icon: BadgeDollarSign },
  { label: "Funcionários", href: "/employees", icon: Users },
  { label: "Relatórios", href: "/reports", icon: BarChart3 },
  { label: "Configurações", href: "/settings", icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-72 shrink-0 bg-nav p-4 text-white lg:block">
      <div className="flex h-full flex-col rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-3 border-b border-white/10 pb-5">
          <img
            src="/logo.png"
            alt="Gratão Uniformes"
            className="h-14 w-16 rounded-sm object-contain shadow-[0_14px_28px_rgba(0,0,0,0.28)]"
          />
          <div>
            <p className="text-base font-black leading-none">Gratão Flow</p>
            <p className="mt-1 text-xs font-medium text-white/58">Gratão Uniformes</p>
          </div>
        </div>

        <div className="my-5 rounded-md border border-accent/30 bg-accent/[0.12] p-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/72">
              Produção
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-white/62">
            Gestão diária de ordens, equipe, estoque e financeiro.
          </p>
        </div>

        <nav className="space-y-1.5">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold text-white/66 transition hover:bg-white/8 hover:text-white",
                  active &&
                    "bg-accent text-nav shadow-[0_14px_32px_rgba(201,151,43,0.24)] hover:bg-accent hover:text-nav"
                )}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
