"use client";

import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CatalogProduct, CatalogSize, StockCategory, StockItem } from "./types";

type Props = {
  open: boolean;
  products: CatalogProduct[];
  sizes: CatalogSize[];
  onClose: () => void;
  onCreated: (item: StockItem) => void;
};

type FormState = {
  name: string;
  category: StockCategory;
  product_id: string;
  size_id: string;
  color: string;
  quantity: string;
  notes: string;
};

const initialState: FormState = {
  name: "",
  category: "material",
  product_id: "",
  size_id: "",
  color: "",
  quantity: "0",
  notes: ""
};

export function StockItemModal({ open, products, sizes, onClose, onCreated }: Props) {
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initialState);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate() {
    if (!form.name.trim()) return "Informe o nome do item.";
    if (!form.category) return "Informe a categoria.";
    if (Number(form.quantity) < 0 || Number.isNaN(Number(form.quantity))) {
      return "A quantidade inicial deve ser maior ou igual a zero.";
    }
    if (form.category === "piece" && (!form.product_id || !form.size_id)) {
      return "Para peca, informe produto e tamanho.";
    }
    if (form.category === "piece" && Number(form.quantity) > 0 && !form.notes.trim()) {
      return "Informe uma observacao para cadastrar saldo fisico pre-existente.";
    }
    return null;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const item = await api.post<StockItem>("/stock/items", {
        name: form.name.trim(),
        category: form.category,
        product_id: form.category === "piece" ? Number(form.product_id) : null,
        size_id: form.category === "piece" ? Number(form.size_id) : null,
        color: form.color.trim() || null,
        quantity: form.quantity,
        notes: form.notes.trim() || null
      });
      onCreated(item);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel criar o item.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-nav/45 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-line bg-white shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Estoque</p>
            <h2 className="mt-1 text-xl font-black text-ink">Novo item</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-md text-muted transition hover:bg-[#FCFAF6] hover:text-ink focus-visible:focus-ring"
            aria-label="Fechar modal"
            disabled={submitting}
          >
            <X size={18} />
          </button>
        </div>

        <form className="space-y-4 p-5" onSubmit={submit}>
          {error ? (
            <div className="rounded-md border border-danger/20 bg-danger/10 p-3 text-sm font-semibold text-danger">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Nome" value={form.name} onChange={(event) => update("name", event.target.value)} />
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-ink">Categoria</span>
              <select
                className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
                value={form.category}
                onChange={(event) => update("category", event.target.value as StockCategory)}
              >
                <option value="material">Material</option>
                <option value="piece">Peca cortada disponivel</option>
              </select>
            </label>
          </div>

          <div className={cn("grid gap-4 md:grid-cols-2", form.category !== "piece" && "hidden")}>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-ink">Produto</span>
              <select
                className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
                value={form.product_id}
                onChange={(event) => update("product_id", event.target.value)}
              >
                <option value="">Selecione</option>
                {products.filter((product) => product.is_active !== false).map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-ink">Tamanho</span>
              <select
                className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
                value={form.size_id}
                onChange={(event) => update("size_id", event.target.value)}
              >
                <option value="">Selecione</option>
                {sizes.map((size) => (
                  <option key={size.id} value={size.id}>
                    {size.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Cor" value={form.color} onChange={(event) => update("color", event.target.value)} />
            <Input label={form.category === "piece" ? "Saldo livre inicial" : "Quantidade inicial"} type="number" min="0" step="0.01" value={form.quantity} onChange={(event) => update("quantity", event.target.value)} />
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">
              Observacoes{form.category === "piece" && Number(form.quantity) > 0 ? " *" : ""}
            </span>
            <textarea
              className="min-h-24 w-full rounded-md border border-line bg-white px-3 py-3 text-sm text-ink shadow-insetline transition placeholder:text-muted/70 focus:focus-ring"
              value={form.notes}
              onChange={(event) => update("notes", event.target.value)}
            />
          </label>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={submitting}>
              <Check size={18} />
              Salvar item
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
