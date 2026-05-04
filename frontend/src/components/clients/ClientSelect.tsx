"use client";

import { Plus } from "lucide-react";
import type { SelectHTMLAttributes } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { ClientModal } from "./ClientModal";
import type { Client } from "./types";

type ClientSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  clients: Client[];
  label?: string;
  error?: string;
  loading?: boolean;
  onClientCreated: (client: Client) => void;
};

export function ClientSelect({
  clients,
  label = "Cliente",
  error,
  loading = false,
  className,
  onClientCreated,
  ...props
}: ClientSelectProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const activeClients = clients.filter((client) => client.is_active !== false);
  const inputId = props.id ?? props.name;

  return (
    <div className="space-y-3">
      <label className="block space-y-2" htmlFor={inputId}>
        <span className="text-sm font-semibold text-ink">{label}</span>
        <select
          id={inputId}
          className={cn(
            "h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring",
            error && "border-danger/60 ring-2 ring-danger/10",
            className
          )}
          {...props}
          disabled={loading || props.disabled}
        >
          <option value="">{loading ? "Carregando clientes..." : "Selecione..."}</option>
          {activeClients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
              {client.phone ? ` - ${client.phone}` : ""}
            </option>
          ))}
        </select>
        {error ? <span className="block text-xs font-medium text-danger">{error}</span> : null}
      </label>

      <Button
        type="button"
        variant="secondary"
        className="h-10"
        onClick={() => setModalOpen(true)}
      >
        <Plus size={16} />
        Nao encontrou o cliente? Criar novo
      </Button>

      <ClientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={onClientCreated}
        title="Criar cliente para OS"
      />
    </div>
  );
}
