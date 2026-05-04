"use client";

import { Edit, Plus, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyClientsState } from "./EmptyClientsState";
import type { Client } from "./types";

type ClientTableProps = {
  clients: Client[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
};

export function ClientTable({ clients, loading, onCreate, onEdit, onDelete }: ClientTableProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-white/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
              Cadastros
            </p>
            <h1 className="mt-1 text-2xl font-black text-ink">Clientes</h1>
            <p className="mt-2 text-sm text-muted">
              Gestão de clientes da Gratão Uniformes
            </p>
          </div>
          <Button type="button" onClick={onCreate}>
            <Plus size={18} />
            Novo cliente
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-md border border-line bg-[#FCFAF6]"
              />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <div className="p-5">
            <EmptyClientsState onCreate={onCreate} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-[#FCFAF6] text-xs font-black uppercase tracking-[0.12em] text-muted">
                  {["Nome", "Telefone", "Status", "Acoes"].map((heading) => (
                    <th key={heading} className="border-b border-line px-4 py-3">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="transition hover:bg-accent-soft/28">
                    <td className="border-b border-line/70 px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-md bg-accent-soft text-accent-dark">
                          <Users size={18} />
                        </div>
                        <div>
                          <p className="font-black text-ink">{client.name}</p>
                          {client.notes ? (
                            <p className="mt-1 line-clamp-1 text-xs font-medium text-muted">
                              {client.notes}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-line/70 px-4 py-4 font-semibold text-muted">
                      {client.phone || "Nao informado"}
                    </td>
                    <td className="border-b border-line/70 px-4 py-4">
                      <Badge tone={client.is_active ? "success" : "neutral"}>
                        {client.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="border-b border-line/70 px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="secondary" className="h-9 px-3" onClick={() => onEdit(client)}>
                          <Edit size={15} />
                          Editar
                        </Button>
                        <Button type="button" variant="ghost" className="h-9 px-3 text-danger hover:text-danger" onClick={() => onDelete(client)}>
                          <Trash2 size={15} />
                          {client.can_delete ? "Excluir" : "Desativar"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
