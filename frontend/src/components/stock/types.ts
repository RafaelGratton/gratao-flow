export type StockCategory = "material" | "piece";

export type StockCategoryFilter = "all" | StockCategory;

export type CatalogProduct = {
  id: number;
  name: string;
  is_active?: boolean;
};

export type CatalogSize = {
  id: number;
  label: string;
};

export type StockMovementType =
  | "entry"
  | "exit"
  | "adjustment"
  | "excess_cut"
  | "cut_entry"
  | "allocated_to_order"
  | "returned_from_order"
  | "loss";

export type StockMovement = {
  id: number;
  movement_type: StockMovementType;
  quantity: string;
  previous_quantity: string;
  new_quantity: string;
  reference_type: string | null;
  reference_id: number | null;
  notes: string | null;
  created_at: string;
};

export type StockItem = {
  id: number;
  name: string;
  category: StockCategory;
  product_id: number | null;
  product: CatalogProduct | null;
  size_id: number | null;
  size: CatalogSize | null;
  color: string | null;
  unit: string;
  quantity: string;
  notes: string | null;
  is_active: boolean;
  can_delete?: boolean;
  created_at: string;
};

export type StockItemDetail = StockItem & {
  movements: StockMovement[];
};
