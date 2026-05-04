"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

type ReportModalShellProps = {
  title: string;
  description: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function ReportModalShell({ title, description, open, onClose, children }: ReportModalShellProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3 py-4 md:items-center">
      <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-lg border border-line bg-white shadow-[0_24px_80px_rgba(23,23,23,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-xl font-black text-ink">{title}</h2>
            <p className="mt-1 text-sm text-muted">{description}</p>
          </div>
          <Button type="button" variant="ghost" className="h-9 w-9 px-0" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </Button>
        </div>
        <div className="max-h-[calc(88vh-88px)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
