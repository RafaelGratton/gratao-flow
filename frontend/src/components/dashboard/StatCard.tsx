import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  detail: string;
  icon: ReactNode;
  className?: string;
  href?: string;
};

export function StatCard({ label, value, detail, icon, className, href }: StatCardProps) {
  const content = (
    <Card className={cn("h-full p-5", href && "transition hover:border-accent/45 hover:bg-accent-soft/20", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{label}</p>
          <p className="mt-3 break-words text-3xl font-black text-ink">{value}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-nav text-accent shadow-[inset_0_0_0_1px_rgba(201,151,43,0.34)]">
          {icon}
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted">{detail}</p>
    </Card>
  );

  return href ? (
    <Link href={href} className="block h-full focus:focus-ring">
      {content}
    </Link>
  ) : content;
}
