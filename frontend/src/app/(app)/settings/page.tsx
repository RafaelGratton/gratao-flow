"use client";

import { Check, Edit, Plus, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";

type Service = {
  id: number;
  name: string;
  type: string;
  price_per_unit: string;
  is_active: boolean;
  can_delete?: boolean;
};

type Product = {
  id: number;
  name: string;
  is_active: boolean;
  can_delete?: boolean;
};

type Size = {
  id: number;
  label: string;
  is_active: boolean;
  can_delete?: boolean;
  created_at?: string;
};

const serviceTypes = ["corte", "serigrafia", "confeccao", "terceirizacao", "extra"] as const;

type SystemSettings = {
  id: number;
  company_name: string;
  company_phone: string;
  company_address: string;
  company_email: string | null;
};

const emptySettings: SystemSettings = {
  id: 1,
  company_name: "",
  company_phone: "",
  company_address: "",
  company_email: ""
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>(emptySettings);
  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingSize, setEditingSize] = useState<Size | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingSize, setSavingSize] = useState(false);
  const [savingService, setSavingService] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      setLoading(true);
      setError(null);
      try {
        const [settingsData, productData, sizeData, serviceData] = await Promise.all([
          api.get<SystemSettings>("/settings"),
          api.get<Product[]>("/products"),
          api.get<Size[]>("/sizes"),
          api.get<Service[]>("/services")
        ]);

        if (active) {
          setSettings(settingsData);
          setProducts(productData);
          setSizes(sizeData);
          setServices(serviceData);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Nao foi possivel carregar as configuracoes."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      active = false;
    };
  }, []);

  async function saveCompanyData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSettings(true);
    setError(null);
    setFeedback(null);

    try {
      const updated = await api.put<SystemSettings>("/settings", {
        company_name: settings.company_name,
        company_phone: settings.company_phone,
        company_address: settings.company_address,
        company_email: settings.company_email || null
      });
      setSettings(updated);
      setFeedback("Dados da empresa salvos com sucesso.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel salvar os dados da empresa."
      );
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingService) return;

    setSavingService(true);
    setError(null);
    setFeedback(null);

    try {
      const payload = {
        name: editingService.name.trim() || null,
        type: editingService.type,
        price_per_unit: editingService.price_per_unit,
        is_active: editingService.is_active
      };
      const updated =
        editingService.id === 0
          ? await api.post<Service>("/services", payload)
          : await api.put<Service>(`/services/${editingService.id}`, payload);
      setServices((current) => [
        updated,
        ...current.filter((service) => service.id !== updated.id)
      ]);
      setEditingService(null);
      setFeedback("Servico salvo com sucesso.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel salvar o servico."
      );
    } finally {
      setSavingService(false);
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProduct) return;

    setSavingProduct(true);
    setError(null);
    setFeedback(null);

    try {
      const payload = {
        name: editingProduct.name.trim(),
        is_active: editingProduct.is_active
      };
      const updated =
        editingProduct.id === 0
          ? await api.post<Product>("/products", payload)
          : await api.put<Product>(`/products/${editingProduct.id}`, payload);
      setProducts((current) => [
        updated,
        ...current.filter((product) => product.id !== updated.id)
      ]);
      setEditingProduct(null);
      setFeedback("Produto salvo com sucesso.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel salvar o produto."
      );
    } finally {
      setSavingProduct(false);
    }
  }

  async function saveSize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingSize) return;

    setSavingSize(true);
    setError(null);
    setFeedback(null);

    try {
      const payload = {
        label: editingSize.label.trim(),
        is_active: editingSize.is_active
      };
      const updated =
        editingSize.id === 0
          ? await api.post<Size>("/sizes", { label: payload.label })
          : await api.put<Size>(`/sizes/${editingSize.id}`, payload);
      setSizes((current) => [updated, ...current.filter((size) => size.id !== updated.id)]);
      setEditingSize(null);
      setFeedback("Tamanho salvo com sucesso.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel salvar o tamanho."
      );
    } finally {
      setSavingSize(false);
    }
  }

  async function deleteProduct(product: Product) {
    const action = product.can_delete ? "excluido" : "desativado";
    const confirmed = window.confirm(
      `Este produto sera ${action} da operacao. OS antigas continuam mostrando o produto cadastrado. Deseja continuar?`
    );
    if (!confirmed) return;

    setError(null);
    setFeedback(null);
    try {
      const updated = await api.delete<Product | undefined>(`/products/${product.id}`);
      if (updated) {
        setProducts((current) =>
          current.map((item) => (item.id === updated.id ? updated : item))
        );
        setFeedback("Produto desativado com sucesso.");
      } else {
        setProducts((current) => current.filter((item) => item.id !== product.id));
        setFeedback("Produto excluido com sucesso.");
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Nao foi possivel remover o produto."
      );
    }
  }

  async function deleteSize(size: Size) {
    const action = size.can_delete ? "excluido" : "desativado";
    const confirmed = window.confirm(
      `Este tamanho sera ${action} da operacao. Registros antigos continuam mostrando o tamanho cadastrado. Deseja continuar?`
    );
    if (!confirmed) return;

    setError(null);
    setFeedback(null);
    try {
      const updated = await api.delete<Size | undefined>(`/sizes/${size.id}`);
      if (updated) {
        setSizes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setFeedback("Tamanho desativado. Ele continuara visivel em registros antigos.");
      } else {
        setSizes((current) => current.filter((item) => item.id !== size.id));
        setFeedback("Tamanho excluido com sucesso.");
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Nao foi possivel remover o tamanho."
      );
    }
  }

  async function deleteService(service: Service) {
    const action = service.can_delete ? "excluido" : "desativado";
    const confirmed = window.confirm(
      `Este servico sera ${action} da operacao. OS antigas continuam preservando o servico e o preco congelado. Deseja continuar?`
    );
    if (!confirmed) return;

    setError(null);
    setFeedback(null);
    try {
      const updated = await api.delete<Service | undefined>(`/services/${service.id}`);
      if (updated) {
        setServices((current) =>
          current.map((item) => (item.id === updated.id ? updated : item))
        );
        setFeedback("Servico desativado com sucesso.");
      } else {
        setServices((current) => current.filter((item) => item.id !== service.id));
        setFeedback("Servico excluido com sucesso.");
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Nao foi possivel remover o servico."
      );
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-black text-ink">Configurações</h1>
        <p className="mt-1 text-sm font-medium text-muted">
          Parâmetros do sistema e da empresa
        </p>
      </header>

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

      <section className="rounded-lg border border-line bg-white shadow-insetline">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-lg font-black text-ink">Dados da Empresa</h2>
        </div>

        <form className="grid gap-4 p-5 md:grid-cols-2" onSubmit={saveCompanyData}>
          <Input
            label="Nome da empresa"
            value={settings.company_name}
            onChange={(event) =>
              setSettings((current) => ({ ...current, company_name: event.target.value }))
            }
            required
            disabled={loading}
          />
          <Input
            label="Telefone"
            value={settings.company_phone}
            onChange={(event) =>
              setSettings((current) => ({ ...current, company_phone: event.target.value }))
            }
            required
            disabled={loading}
          />
          <Input
            label="Endereço"
            value={settings.company_address}
            onChange={(event) =>
              setSettings((current) => ({ ...current, company_address: event.target.value }))
            }
            required
            disabled={loading}
          />
          <Input
            label="Email"
            type="email"
            value={settings.company_email ?? ""}
            onChange={(event) =>
              setSettings((current) => ({ ...current, company_email: event.target.value }))
            }
            disabled={loading}
          />
          <div className="md:col-span-2">
            <Button type="submit" isLoading={savingSettings} disabled={loading}>
              <Check size={18} />
              Salvar dados
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-line bg-white shadow-insetline">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-black text-ink">Tamanhos</h2>
            <p className="mt-1 text-sm font-medium text-muted">
              Gerencie os tamanhos usados em OS, estoque e producao.
            </p>
          </div>
          <Button
            type="button"
            onClick={() =>
              setEditingSize({
                id: 0,
                label: "",
                is_active: true,
                can_delete: true
              })
            }
          >
            <Plus size={18} />
            Novo tamanho
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-[#FCFAF6] text-xs font-bold uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="px-5 py-3">Tamanho</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Acao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr>
                  <td className="px-5 py-5 font-semibold text-muted" colSpan={3}>
                    Carregando tamanhos...
                  </td>
                </tr>
              ) : null}
              {!loading && sizes.length === 0 ? (
                <tr>
                  <td className="px-5 py-5 font-semibold text-muted" colSpan={3}>
                    Nenhum tamanho cadastrado.
                  </td>
                </tr>
              ) : null}
              {!loading
                ? sizes.map((size) => (
                    <tr key={size.id}>
                      <td className="px-5 py-4 font-bold text-ink">{size.label}</td>
                      <td className="px-5 py-4">
                        <Badge tone={size.is_active ? "success" : "neutral"}>
                          {size.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setEditingSize(size)}
                          >
                            <Edit size={16} />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-danger hover:text-danger"
                            onClick={() => void deleteSize(size)}
                          >
                            <Trash2 size={16} />
                            {size.can_delete ? "Excluir" : "Desativar"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white shadow-insetline">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-black text-ink">Produtos</h2>
          <Button
            type="button"
            onClick={() =>
              setEditingProduct({
                id: 0,
                name: "",
                is_active: true,
                can_delete: true
              })
            }
          >
            <Plus size={18} />
            Novo produto
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-[#FCFAF6] text-xs font-bold uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="px-5 py-3">Produto</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Acao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr>
                  <td className="px-5 py-5 font-semibold text-muted" colSpan={3}>
                    Carregando produtos...
                  </td>
                </tr>
              ) : null}
              {!loading && products.length === 0 ? (
                <tr>
                  <td className="px-5 py-5 font-semibold text-muted" colSpan={3}>
                    Nenhum produto cadastrado.
                  </td>
                </tr>
              ) : null}
              {!loading
                ? products.map((product) => (
                    <tr key={product.id}>
                      <td className="px-5 py-4 font-bold text-ink">{product.name}</td>
                      <td className="px-5 py-4">
                        <Badge tone={product.is_active ? "success" : "neutral"}>
                          {product.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setEditingProduct(product)}
                          >
                            <Edit size={16} />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-danger hover:text-danger"
                            onClick={() => void deleteProduct(product)}
                          >
                            <Trash2 size={16} />
                            {product.can_delete ? "Excluir" : "Desativar"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white shadow-insetline">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-black text-ink">Tabela de Preços</h2>
          <Button
            type="button"
            onClick={() =>
              setEditingService({
                id: 0,
                name: "",
                type: "corte",
                price_per_unit: "0.00",
                is_active: true,
                can_delete: true
              })
            }
          >
            <Plus size={18} />
            Novo servico
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-[#FCFAF6] text-xs font-bold uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="px-5 py-3">Serviço</th>
                <th className="px-5 py-3">Preço atual</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr>
                  <td className="px-5 py-5 font-semibold text-muted" colSpan={4}>
                    Carregando configurações...
                  </td>
                </tr>
              ) : null}
              {!loading && services.length === 0 ? (
                <tr>
                  <td className="px-5 py-5 font-semibold text-muted" colSpan={4}>
                    Nenhum serviço cadastrado.
                  </td>
                </tr>
              ) : null}
              {!loading
                ? services.map((service) => (
                    <tr key={service.id}>
                      <td className="px-5 py-4 font-bold text-ink">{service.name}</td>
                      <td className="px-5 py-4 font-semibold text-ink">
                        {formatMoney(service.price_per_unit)}
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={service.is_active ? "success" : "neutral"}>
                          {service.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setEditingService(service)}
                          >
                            <Edit size={16} />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-danger hover:text-danger"
                            onClick={() => void deleteService(service)}
                          >
                            <Trash2 size={16} />
                            {service.can_delete ? "Excluir" : "Desativar"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </section>

      <ProductEditModal
        product={editingProduct}
        saving={savingProduct}
        onClose={() => setEditingProduct(null)}
        onChange={setEditingProduct}
        onSubmit={saveProduct}
      />
      <SizeEditModal
        size={editingSize}
        saving={savingSize}
        onClose={() => setEditingSize(null)}
        onChange={setEditingSize}
        onSubmit={saveSize}
      />
      <ServiceEditModal
        service={editingService}
        saving={savingService}
        onClose={() => setEditingService(null)}
        onChange={setEditingService}
        onSubmit={saveService}
      />
    </div>
  );
}

function ServiceEditModal({
  service,
  saving,
  onClose,
  onChange,
  onSubmit
}: {
  service: Service | null;
  saving: boolean;
  onClose: () => void;
  onChange: (service: Service) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!service) return null;

  const title = service.id === 0 ? "Novo serviço" : "Editar serviço";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-nav/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-line bg-white shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
              Tabela de Preços
            </p>
            <h2 className="mt-1 text-xl font-black text-ink">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-md text-muted transition hover:bg-[#FCFAF6] hover:text-ink focus-visible:focus-ring"
            aria-label="Fechar modal"
            disabled={saving}
          >
            <X size={18} />
          </button>
        </div>

        <form className="space-y-4 p-5" onSubmit={onSubmit}>
          <Input
            label="Serviço"
            value={service.name}
            onChange={(event) => onChange({ ...service, name: event.target.value })}
            disabled={saving}
          />
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Tipo</span>
            <select
              className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
              value={service.type}
              onChange={(event) => onChange({ ...service, type: event.target.value })}
              disabled={saving}
            >
              {serviceTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Preço por peça"
            type="number"
            min="0"
            step="0.01"
            value={service.price_per_unit}
            onChange={(event) =>
              onChange({ ...service, price_per_unit: event.target.value })
            }
            required
            disabled={saving}
          />
          <label className="flex items-center gap-3 rounded-md border border-line bg-[#FCFAF6] p-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-line text-accent focus:focus-ring"
              checked={service.is_active}
              onChange={(event) =>
                onChange({ ...service, is_active: event.target.checked })
              }
              disabled={saving}
            />
            Serviço ativo
          </label>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={saving}>
              <Check size={18} />
              Salvar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SizeEditModal({
  size,
  saving,
  onClose,
  onChange,
  onSubmit
}: {
  size: Size | null;
  saving: boolean;
  onClose: () => void;
  onChange: (size: Size) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!size) return null;

  const title = size.id === 0 ? "Novo tamanho" : "Editar tamanho";
  const canEditLabel = size.id === 0 || size.can_delete !== false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-nav/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-line bg-white shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
              Tamanhos
            </p>
            <h2 className="mt-1 text-xl font-black text-ink">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-md text-muted transition hover:bg-[#FCFAF6] hover:text-ink focus-visible:focus-ring"
            aria-label="Fechar modal"
            disabled={saving}
          >
            <X size={18} />
          </button>
        </div>

        <form className="space-y-4 p-5" onSubmit={onSubmit}>
          <Input
            label="Tamanho"
            value={size.label}
            onChange={(event) => onChange({ ...size, label: event.target.value })}
            disabled={saving || !canEditLabel}
            required
          />
          {!canEditLabel ? (
            <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm font-semibold text-ink">
              Este tamanho ja esta em uso. O nome fica preservado para nao alterar registros antigos.
            </p>
          ) : null}
          <label className="flex items-center gap-3 rounded-md border border-line bg-[#FCFAF6] p-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-line text-accent focus:focus-ring"
              checked={size.is_active}
              onChange={(event) => onChange({ ...size, is_active: event.target.checked })}
              disabled={saving}
            />
            Tamanho ativo
          </label>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={saving}>
              <Check size={18} />
              Salvar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProductEditModal({
  product,
  saving,
  onClose,
  onChange,
  onSubmit
}: {
  product: Product | null;
  saving: boolean;
  onClose: () => void;
  onChange: (product: Product) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!product) return null;

  const title = product.id === 0 ? "Novo produto" : "Editar produto";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-nav/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-line bg-white shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
              Produtos
            </p>
            <h2 className="mt-1 text-xl font-black text-ink">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-md text-muted transition hover:bg-[#FCFAF6] hover:text-ink focus-visible:focus-ring"
            aria-label="Fechar modal"
            disabled={saving}
          >
            <X size={18} />
          </button>
        </div>

        <form className="space-y-4 p-5" onSubmit={onSubmit}>
          <Input
            label="Produto"
            value={product.name}
            onChange={(event) => onChange({ ...product, name: event.target.value })}
            disabled={saving}
            required
          />
          <label className="flex items-center gap-3 rounded-md border border-line bg-[#FCFAF6] p-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-line text-accent focus:focus-ring"
              checked={product.is_active}
              onChange={(event) =>
                onChange({ ...product, is_active: event.target.checked })
              }
              disabled={saving}
            />
            Produto ativo
          </label>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={saving}>
              <Check size={18} />
              Salvar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatMoney(value: string) {
  const amount = Number(value);
  if (Number.isNaN(amount)) return "R$ 0,00";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(amount);
}
