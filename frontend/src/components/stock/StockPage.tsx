"use client";

import { useCallback, useEffect, useState } from "react";
import { StockHistoryModal } from "@/components/stock/StockHistoryModal";
import { StockItemModal } from "@/components/stock/StockItemModal";
import { StockMovementModal } from "@/components/stock/StockMovementModal";
import { StockSummaryCards } from "@/components/stock/StockSummaryCards";
import { StockTable } from "@/components/stock/StockTable";
import type { CatalogProduct, CatalogSize, StockItem, StockItemDetail } from "@/components/stock/types";
import { api } from "@/lib/api";

type MovementMode = "entry" | "exit" | "adjust";

export function StockPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [sizes, setSizes] = useState<CatalogSize[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [movementItem, setMovementItem] = useState<StockItem | null>(null);
  const [movementMode, setMovementMode] = useState<MovementMode | null>(null);
  const [historyItem, setHistoryItem] = useState<StockItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stockItems, productList, sizeList] = await Promise.all([
        api.get<StockItem[]>("/stock/items"),
        api.get<CatalogProduct[]>("/products"),
        api.get<CatalogSize[]>("/sizes")
      ]);
      setItems(stockItems);
      setProducts(productList);
      setSizes(sizeList);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel carregar o estoque.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function upsertItem(item: StockItem) {
    setItems((current) => [item, ...current.filter((entry) => entry.id !== item.id)]);
  }

  function handleCreated(item: StockItem) {
    upsertItem(item);
    setFeedback("Item criado com sucesso.");
  }

  function handleMovementSaved(detail: StockItemDetail) {
    upsertItem(detail);
    setFeedback("Movimentacao registrada com sucesso.");
  }

  async function handleDelete(item: StockItem) {
    const confirmed = window.confirm(
      "Este item será removido da operação, mas o histórico será preservado quando existir."
    );
    if (!confirmed) return;

    setError(null);
    setFeedback(null);
    try {
      await api.delete<StockItem | undefined>(`/stock/items/${item.id}`);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setFeedback(item.can_delete ? "Item excluido com sucesso." : "Item desativado com sucesso.");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Nao foi possivel remover o item."
      );
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Gratão Flow</p>
        <h1 className="mt-1 text-3xl font-black text-ink">Estoque</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Controle auditavel de materiais e pecas</p>
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

      <StockSummaryCards items={items} />
      <StockTable
        items={items}
        loading={loading}
        onCreate={() => setItemModalOpen(true)}
        onMovement={(item, mode) => {
          setMovementItem(item);
          setMovementMode(mode);
        }}
        onHistory={setHistoryItem}
        onDelete={handleDelete}
      />

      <StockItemModal
        open={itemModalOpen}
        products={products}
        sizes={sizes}
        onClose={() => setItemModalOpen(false)}
        onCreated={handleCreated}
      />
      <StockMovementModal
        item={movementItem}
        mode={movementMode}
        onClose={() => {
          setMovementItem(null);
          setMovementMode(null);
        }}
        onSaved={handleMovementSaved}
      />
      <StockHistoryModal item={historyItem} onClose={() => setHistoryItem(null)} />
    </div>
  );
}
