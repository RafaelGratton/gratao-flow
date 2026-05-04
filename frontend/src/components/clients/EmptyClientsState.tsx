"use client";

import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

type EmptyClientsStateProps = {
  onCreate: () => void;
};

export function EmptyClientsState({ onCreate }: EmptyClientsStateProps) {
  return (
    <EmptyState
      icon={<UserPlus size={20} />}
      title="Nenhum cliente cadastrado"
      description="Cadastre o primeiro cliente para usar na criação de ordens de serviço."
      className="min-h-64"
    >
      <Button type="button" className="mt-5" onClick={onCreate}>
        <UserPlus size={18} />
        Criar primeiro cliente
      </Button>
    </EmptyState>
  );
}
