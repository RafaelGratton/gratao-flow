import type { ReactNode } from "react";
import { CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, icon, children, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed border-line bg-[#FCFAF6] p-8 text-center",
        className
      )}
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent-dark">
        {icon ?? <CircleDashed size={20} />}
      </div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>
      {children}
    </div>
  );
}
