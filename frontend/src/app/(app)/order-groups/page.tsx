"use client";

import {
  Download,
  Link2,
  PackagePlus,
  RefreshCcw,
  Save,
  Trash2,
  Unlink
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Client } from "@/components/clients/types";
import type {
  ClientOrderGroup,
  ClientOrderGroupCreatePayload,
  ClientOrderGroupOrder,
  ClientOrderGroupUpdatePayload
} from "@/components/order-groups/types";
import {
  financialLabels,
  financialTone,
  productionLabels,
  productionTone
} from "@/components/orders/status";
import type { OrderSummary } from "@/components/orders/types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";

type CreateState = {
  client_id: number;
  reference: string;
  notes: string;
  order_ids: number[];
};

export default function OrderGroupsPage() {
  const [groups, setGroups] = useState<ClientOrderGroup[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [availableOrders, setAvailableOrders] = useState<ClientOrderGroupOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [createState, setCreateState] = useState<CreateState>({
    client_id: 0,
    reference: "",
    notes: "",
    order_ids: []
  });
  const [editState, setEditState] = useState({ reference: "", notes: "" });

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedId) ?? groups[0] ?? null,
    [groups, selectedId]
  );

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedGroup) {
      setAvailableOrders([]);
      setEditState({ reference: "", notes: "" });
      return;
    }
    setSelectedId(selectedGroup.id);
    setEditState({
      reference: selectedGroup.reference,
      notes: selectedGroup.notes ?? ""
    });
    void loadAvailableOrders(selectedGroup.id);
  }, [selectedGroup?.id]);

  const createAvailableOrders = orders.filter(
    (order) =>
      order.client.id === createState.client_id &&
      order.client_order_group_id === null &&
      order.production_status !== "cancelled"
  );

  async function loadInitialData() {
    setLoading(true);
    setError(null);
    try {
      const [groupData, orderData, clientData] = await Promise.all([
        api.get<ClientOrderGroup[]>("/order-groups"),
        api.get<OrderSummary[]>("/orders"),
        api.get<Client[]>("/clients")
      ]);
      setGroups(groupData);
      setOrders(orderData);
      setClients(clientData.filter((client) => client.is_active));
      setSelectedId(groupData[0]?.id ?? null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel carregar os Pedidos de Cliente."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadAvailableOrders(groupId: number) {
    setAvailableLoading(true);
    try {
      const data = await api.get<ClientOrderGroupOrder[]>(
        `/order-groups/${groupId}/available-orders`
      );
      setAvailableOrders(data);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel carregar OS disponiveis."
      );
    } finally {
      setAvailableLoading(false);
    }
  }

  async function refreshAfterChange(groupId?: number) {
    const [groupData, orderData] = await Promise.all([
      api.get<ClientOrderGroup[]>("/order-groups"),
      api.get<OrderSummary[]>("/orders")
    ]);
    setGroups(groupData);
    setOrders(orderData);
    const nextId = groupId ?? groupData.find((group) => group.id === selectedId)?.id ?? groupData[0]?.id;
    setSelectedId(nextId ?? null);
    if (nextId) {
      await loadAvailableOrders(nextId);
    }
  }

  async function handleCreate() {
    setError(null);
    setFeedback(null);
    if (!createState.client_id) {
      setError("Escolha um cliente para criar o Pedido de Cliente.");
      return;
    }
    if (!createState.reference.trim()) {
      setError("Informe uma referencia para o Pedido de Cliente.");
      return;
    }
    if (createState.order_ids.length === 0) {
      setError("Selecione ao menos uma OS para agrupar.");
      return;
    }

    setSaving(true);
    try {
      const payload: ClientOrderGroupCreatePayload = {
        client_id: createState.client_id,
        reference: createState.reference.trim(),
        notes: createState.notes.trim() || null,
        order_ids: createState.order_ids
      };
      const created = await api.post<ClientOrderGroup>("/order-groups", payload);
      setCreateState({ client_id: 0, reference: "", notes: "", order_ids: [] });
      setFeedback(`Pedido de Cliente #${created.id} criado.`);
      await refreshAfterChange(created.id);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel criar o Pedido de Cliente."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(group: ClientOrderGroup) {
    setActionLoading("update");
    setError(null);
    setFeedback(null);
    try {
      const payload: ClientOrderGroupUpdatePayload = {
        reference: editState.reference.trim(),
        notes: editState.notes.trim() || null
      };
      const updated = await api.put<ClientOrderGroup>(`/order-groups/${group.id}`, payload);
      setFeedback(`Pedido de Cliente #${updated.id} atualizado.`);
      await refreshAfterChange(updated.id);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel atualizar o Pedido de Cliente."
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(group: ClientOrderGroup) {
    const confirmed = window.confirm(
      "Remover este Pedido de Cliente vai apenas desvincular as OS. As OS nao serao apagadas. Continuar?"
    );
    if (!confirmed) return;
    setActionLoading("delete");
    setError(null);
    setFeedback(null);
    try {
      await api.delete(`/order-groups/${group.id}`);
      setFeedback(`Pedido de Cliente #${group.id} removido e OS desvinculadas.`);
      await refreshAfterChange();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel remover o Pedido de Cliente."
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleLink(group: ClientOrderGroup, orderId: number) {
    setActionLoading(`link-${orderId}`);
    setError(null);
    setFeedback(null);
    try {
      await api.post<ClientOrderGroup>(`/order-groups/${group.id}/orders/${orderId}`);
      setFeedback(`OS #${orderId} vinculada.`);
      await refreshAfterChange(group.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel vincular a OS.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnlink(group: ClientOrderGroup, orderId: number) {
    setActionLoading(`unlink-${orderId}`);
    setError(null);
    setFeedback(null);
    try {
      await api.delete<ClientOrderGroup>(`/order-groups/${group.id}/orders/${orderId}`);
      setFeedback(`OS #${orderId} desvinculada.`);
      await refreshAfterChange(group.id);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Nao foi possivel desvincular a OS."
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDownload(group: ClientOrderGroup, kind: "client" | "internal") {
    setActionLoading(`download-${kind}`);
    setError(null);
    try {
      const blob = await api.downloadBlob(`/order-groups/${group.id}/report/${kind}/pdf`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `pedido-cliente-${group.id}-${kind}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Nao foi possivel baixar o PDF."
      );
    } finally {
      setActionLoading(null);
    }
  }

  function toggleCreateOrder(orderId: number) {
    setCreateState((current) => ({
      ...current,
      order_ids: current.order_ids.includes(orderId)
        ? current.order_ids.filter((id) => id !== orderId)
        : [...current.order_ids, orderId]
    }));
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-line bg-white/90 p-5 shadow-soft">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
              Pedidos de Cliente
            </p>
            <h1 className="mt-1 text-2xl font-black text-ink">Pedidos agrupados</h1>
            <p className="mt-2 text-sm font-semibold text-muted">
              Agrupe varias OS do mesmo cliente sem alterar a producao individual.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={loadInitialData}>
            <RefreshCcw size={18} />
            Atualizar
          </Button>
        </div>
      </div>

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

      <Card>
        <CardHeader>
          <h2 className="text-lg font-black text-ink">Novo Pedido de Cliente</h2>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                Cliente
              </span>
              <select
                value={createState.client_id}
                onChange={(event) =>
                  setCreateState({
                    ...createState,
                    client_id: Number(event.target.value),
                    order_ids: []
                  })
                }
                className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm font-semibold text-ink outline-none focus-visible:focus-ring"
              >
                <option value={0}>Selecione</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                Referencia
              </span>
              <input
                value={createState.reference}
                onChange={(event) => setCreateState({ ...createState, reference: event.target.value })}
                className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm font-semibold text-ink outline-none focus-visible:focus-ring"
                placeholder="Ex.: Pedido inverno / Escola X"
              />
            </label>
            <label className="space-y-2 lg:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                Observacoes
              </span>
              <textarea
                value={createState.notes}
                onChange={(event) => setCreateState({ ...createState, notes: event.target.value })}
                className="min-h-20 w-full rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink outline-none focus-visible:focus-ring"
              />
            </label>
          </div>
          <div className="mt-4 rounded-md border border-line bg-[#FCFAF6]">
            <div className="border-b border-line px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-muted">
              OS disponiveis para vincular
            </div>
            {createAvailableOrders.length === 0 ? (
              <p className="p-4 text-sm font-semibold text-muted">
                Selecione um cliente com OS sem Pedido de Cliente.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {createAvailableOrders.map((order) => (
                  <label
                    key={order.id}
                    className="flex cursor-pointer items-start gap-3 border-b border-line/70 px-4 py-3 last:border-b-0 hover:bg-white"
                  >
                    <input
                      type="checkbox"
                      checked={createState.order_ids.includes(order.id)}
                      onChange={() => toggleCreateOrder(order.id)}
                      className="mt-1 h-4 w-4"
                    />
                    <div>
                      <p className="font-black text-ink">OS #{order.id}</p>
                      <p className="mt-1 text-sm font-semibold text-muted">{orderSummaryLabel(order)}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="button" onClick={handleCreate} isLoading={saving}>
              <PackagePlus size={18} />
              Criar Pedido de Cliente
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="bg-white/70">
          <h2 className="text-lg font-black text-ink">Lista de Pedidos de Cliente</h2>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-md border border-line bg-[#FCFAF6]" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<PackagePlus size={20} />}
                title="Nenhum Pedido de Cliente"
                description="Crie um pedido agrupado para consolidar valores e PDFs de varias OS."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1120px] w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="bg-[#FCFAF6] text-xs font-black uppercase tracking-[0.12em] text-muted">
                    {["Pedido", "Cliente", "OS", "Producao", "Financeiro", "Total pedido", "Pago", "Saldo"].map(
                      (heading) => (
                        <th key={heading} className="border-b border-line px-4 py-3">
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <tr
                      key={group.id}
                      onClick={() => setSelectedId(group.id)}
                      className={`cursor-pointer transition hover:bg-accent-soft/28 ${
                        selectedGroup?.id === group.id ? "bg-accent-soft/35" : ""
                      }`}
                    >
                      <td className="border-b border-line/70 px-4 py-4">
                        <p className="font-black text-ink">#{group.id}</p>
                        <p className="mt-1 text-xs font-semibold text-muted">{group.reference}</p>
                      </td>
                      <td className="border-b border-line/70 px-4 py-4 font-semibold text-ink">
                        {group.client.name}
                      </td>
                      <td className="border-b border-line/70 px-4 py-4 text-muted">
                        {group.order_count} OS / {group.quantity_requested} pecas
                      </td>
                      <td className="border-b border-line/70 px-4 py-4">
                        <StatusBadge
                          label={productionLabels[group.production_status]}
                          status={productionTone(group.production_status)}
                        />
                      </td>
                      <td className="border-b border-line/70 px-4 py-4">
                        <StatusBadge
                          label={financialLabels[group.financial_status]}
                          status={financialTone(group.financial_status)}
                        />
                      </td>
                      <td className="border-b border-line/70 px-4 py-4 font-bold text-ink">
                        {formatCurrency(group.total_amount)}
                      </td>
                      <td className="border-b border-line/70 px-4 py-4 text-muted">
                        {formatCurrency(group.amount_paid)}
                      </td>
                      <td className="border-b border-line/70 px-4 py-4 font-bold text-warning">
                        {formatCurrency(group.amount_due)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedGroup ? (
        <OrderGroupDetails
          group={selectedGroup}
          editState={editState}
          setEditState={setEditState}
          availableOrders={availableOrders}
          availableLoading={availableLoading}
          actionLoading={actionLoading}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onLink={handleLink}
          onUnlink={handleUnlink}
          onDownload={handleDownload}
        />
      ) : null}
    </div>
  );
}

function OrderGroupDetails({
  group,
  editState,
  setEditState,
  availableOrders,
  availableLoading,
  actionLoading,
  onUpdate,
  onDelete,
  onLink,
  onUnlink,
  onDownload
}: {
  group: ClientOrderGroup;
  editState: { reference: string; notes: string };
  setEditState: (value: { reference: string; notes: string }) => void;
  availableOrders: ClientOrderGroupOrder[];
  availableLoading: boolean;
  actionLoading: string | null;
  onUpdate: (group: ClientOrderGroup) => void;
  onDelete: (group: ClientOrderGroup) => void;
  onLink: (group: ClientOrderGroup, orderId: number) => void;
  onUnlink: (group: ClientOrderGroup, orderId: number) => void;
  onDownload: (group: ClientOrderGroup, kind: "client" | "internal") => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
                Pedido de Cliente #{group.id}
              </p>
              <h2 className="mt-1 text-xl font-black text-ink">{group.reference}</h2>
              <p className="mt-1 text-sm font-semibold text-muted">
                {group.client.name} / atualizado em {formatDateTime(group.updated_at)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge
                label={productionLabels[group.production_status]}
                status={productionTone(group.production_status)}
              />
              <StatusBadge
                label={financialLabels[group.financial_status]}
                status={financialTone(group.financial_status)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryTile label="Total pedido" value={formatCurrency(group.total_amount)} />
            <SummaryTile label="Pago" value={formatCurrency(group.amount_paid)} />
            <SummaryTile label="Saldo" value={formatCurrency(group.amount_due)} tone="warning" />
            <SummaryTile label="Terc. vendida" value={formatCurrency(group.outsourcing_revenue_total)} />
            <SummaryTile label="Custo terc." value={formatCurrency(group.outsourcing_cost_total)} />
            <SummaryTile label="Repasse pend." value={formatCurrency(group.outsourcing_pending_total)} />
            <SummaryTile
              label="Resultado"
              value={formatCurrency(group.estimated_result)}
              tone={Number(group.estimated_result) < 0 ? "danger" : "success"}
            />
          </div>

          <div className="mt-5 grid gap-4">
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                Referencia
              </span>
              <input
                value={editState.reference}
                onChange={(event) => setEditState({ ...editState, reference: event.target.value })}
                className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm font-semibold text-ink outline-none focus-visible:focus-ring"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                Observacoes
              </span>
              <textarea
                value={editState.notes}
                onChange={(event) => setEditState({ ...editState, notes: event.target.value })}
                className="min-h-20 w-full rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink outline-none focus-visible:focus-ring"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onUpdate(group)}
              isLoading={actionLoading === "update"}
            >
              <Save size={18} />
              Salvar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onDownload(group, "client")}
              isLoading={actionLoading === "download-client"}
            >
              <Download size={18} />
              PDF cliente
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onDownload(group, "internal")}
              isLoading={actionLoading === "download-internal"}
            >
              <Download size={18} />
              PDF interno
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-danger hover:text-danger"
              onClick={() => onDelete(group)}
              isLoading={actionLoading === "delete"}
            >
              <Trash2 size={18} />
              Remover
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-black text-ink">OS vinculadas</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {group.orders.map((order) => (
              <div key={order.id} className="rounded-md border border-line bg-[#FCFAF6] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-black text-ink">OS #{order.id}</p>
                    <p className="mt-1 text-sm font-semibold text-muted">{orderSummaryLabel(order)}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge
                        label={productionLabels[order.production_status]}
                        status={productionTone(order.production_status)}
                      />
                      <StatusBadge
                        label={financialLabels[order.financial_status]}
                        status={financialTone(order.financial_status)}
                      />
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="font-black text-ink">{formatCurrency(order.total_amount)}</p>
                    <p className="mt-1 text-sm font-semibold text-muted">
                      Pago {formatCurrency(order.amount_paid)} / saldo {formatCurrency(order.amount_due)}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      className="mt-2 h-9 px-3 text-danger hover:text-danger"
                      onClick={() => onUnlink(group, order.id)}
                      isLoading={actionLoading === `unlink-${order.id}`}
                    >
                      <Unlink size={16} />
                      Desvincular
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-md border border-line bg-white">
            <div className="border-b border-line px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-muted">
              Vincular OS existente
            </div>
            {availableLoading ? (
              <p className="p-4 text-sm font-semibold text-muted">Carregando OS disponiveis...</p>
            ) : availableOrders.length === 0 ? (
              <p className="p-4 text-sm font-semibold text-muted">
                Nenhuma OS livre deste cliente para vincular.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {availableOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-col gap-3 border-b border-line/70 px-4 py-3 last:border-b-0 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-black text-ink">OS #{order.id}</p>
                      <p className="mt-1 text-sm font-semibold text-muted">{orderSummaryLabel(order)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-9 px-3"
                      onClick={() => onLink(group, order.id)}
                      isLoading={actionLoading === `link-${order.id}`}
                    >
                      <Link2 size={16} />
                      Vincular
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: "default" | "warning" | "success" | "danger";
}) {
  const toneClass =
    tone === "warning"
      ? "text-warning"
      : tone === "success"
        ? "text-success"
        : tone === "danger"
          ? "text-danger"
          : "text-ink";
  return (
    <div className="rounded-md border border-line bg-[#FCFAF6] p-3">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={`mt-2 text-lg font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

function orderSummaryLabel(order: Pick<ClientOrderGroupOrder, "items" | "quantity_requested"> | OrderSummary) {
  const items = "items" in order ? order.items.filter((item) => !item.is_cancelled) : [];
  if (items.length === 0) {
    return `${order.quantity_requested} pecas`;
  }
  return items
    .slice(0, 3)
    .map(
      (item) =>
        `${item.quantity_requested}x ${item.product.name} ${item.size.label}${item.color ? ` / ${item.color}` : ""}`
    )
    .join(" | ");
}
