import Link from "next/link";
import { Boxes, ClipboardPlus, Factory, PackageCheck, Scissors } from "lucide-react";

const actions = [
  { label: "Nova OS", href: "/orders/new", icon: ClipboardPlus },
  { label: "Corte e destinação", href: "/cutting", icon: Scissors },
  { label: "Produção", href: "/production", icon: Factory },
  { label: "Entregas", href: "/deliveries", icon: PackageCheck },
  { label: "Estoque", href: "/stock", icon: Boxes }
];

export function DashboardQuickActions() {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Atalhos operacionais">
      {actions.map(({ label, href, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-ink shadow-insetline transition hover:bg-accent-soft/70 focus:focus-ring"
        >
          <Icon size={16} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
