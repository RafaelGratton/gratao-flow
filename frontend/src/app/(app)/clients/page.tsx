"use client";

import { useEffect, useState } from "react";
import { ClientModal } from "@/components/clients/ClientModal";
import { ClientTable } from "@/components/clients/ClientTable";
import type { Client } from "@/components/clients/types";
import { api } from "@/lib/api";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadClients() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<Client[]>("/clients");
        if (active) {
          setClients(data);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Nao foi possivel carregar os clientes."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadClients();

    return () => {
      active = false;
    };
  }, []);

  function handleSaved(client: Client) {
    setClients((current) => [client, ...current.filter((item) => item.id !== client.id)]);
    setFeedback(editingClient ? "Cliente atualizado com sucesso." : "Cliente criado com sucesso.");
    setEditingClient(null);
  }

  async function handleDelete(client: Client) {
    const confirmed = window.confirm(
      "Este cliente será removido da operação. OS antigas continuam preservando o histórico. Deseja continuar?"
    );
    if (!confirmed) return;

    setError(null);
    setFeedback(null);
    try {
      const updated = await api.delete<Client | undefined>(`/clients/${client.id}`);
      if (updated) {
        setClients((current) =>
          current.map((item) => (item.id === updated.id ? updated : item))
        );
        setFeedback("Cliente desativado com sucesso.");
      } else {
        setClients((current) => current.filter((item) => item.id !== client.id));
        setFeedback("Cliente excluido com sucesso.");
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Nao foi possivel remover o cliente."
      );
    }
  }

  return (
    <div className="space-y-5">
      {feedback ? (
        <div className="rounded-md border border-success/20 bg-success/10 p-4 text-sm font-semibold text-success">
          {feedback}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger/10 p-4 text-sm font-semibold text-danger">
          {error}
        </div>
      ) : null}

      <ClientTable
        clients={clients}
        loading={loading}
        onCreate={() => {
          setEditingClient(null);
          setModalOpen(true);
        }}
        onEdit={(client) => {
          setEditingClient(client);
          setModalOpen(true);
        }}
        onDelete={handleDelete}
      />
      <ClientModal
        open={modalOpen}
        client={editingClient}
        onClose={() => {
          setModalOpen(false);
          setEditingClient(null);
        }}
        onSaved={handleSaved}
      />
    </div>
  );
}
