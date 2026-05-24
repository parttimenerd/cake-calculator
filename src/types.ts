// ─── Primitives ──────────────────────────────────────────────────────────────
export type IngredientId = string;
export type PlateId = string;
export type PriceTier = 'retail' | 'gastro';

// ─── YAML recipe definition ───────────────────────────────────────────────────
export interface BulkDiscount {
  minPacks: number;
  packPrice: number;
}

export interface YamlPriceEntry {
  packSize: number;
  packPrice: number;
  bulkDiscount?: BulkDiscount;
}

export interface YamlIngredient {
  id: IngredientId;
  label: string;
  unit: 'g' | 'ml';
  baseAmount: number;
  kcalPerUnit: number;
  role?: 'weight_pct' | 'optional_toggle';
  sliderMin?: number;
  sliderMax?: number;
  toggleLabel?: string;
  prices: {
    retail?: YamlPriceEntry;
    gastro?: YamlPriceEntry;
  };
}

export interface YamlPlate {
  id: PlateId;
  label: string;
  widthCm: number;
  lengthCm: number;
  default?: boolean;
  adjustable?: boolean;
}

export interface YamlBatter {
  baseMl: number;
  extraLiquidPerBatchMl?: number;
  extraLiquidLabel?: string;
}

export interface YamlTopping {
  label: string;
  sliderLabel?: string;
  defaultPercent?: number;
  ingredients: YamlIngredient[];
}

export interface RecipeDefinition {
  id: string;
  name: string;
  source?: string;
  description?: string;
  plates: YamlPlate[];
  batter: YamlBatter;
  ingredients: YamlIngredient[];
  topping?: YamlTopping;
}

// ─── Derived/runtime ingredient representation ────────────────────────────────
export interface RecipeIngredient {
  id: IngredientId;
  label: string;
  baseAmount: number;
  unit: 'g' | 'ml';
  kcalPerUnit: number;
  role: 'normal' | 'weight_pct' | 'optional_toggle';
  isTopping: boolean;
  toggleLabel?: string;
  sliderMin?: number;
  sliderMax?: number;
}

// ─── Price types ──────────────────────────────────────────────────────────────
export interface IngredientPrice {
  pricePerUnit: number;
  packSize: number;
  packPrice: number;
  bulkDiscount?: BulkDiscount;
}

export type PriceTable = Record<IngredientId, Record<PriceTier, IngredientPrice>>;

// ─── Runtime config ───────────────────────────────────────────────────────────
export interface RecipeConfig {
  plateId: PlateId;
  weightPctValue: number;
  toppingPercent: number;
  bowlLiters: number;
  enabledToggles: IngredientId[];
  ingredientMultipliers?: Partial<Record<IngredientId, number>>;
}

export interface PlateConfig {
  widthCm: number;
  lengthCm: number;
}

// ─── Slice config ─────────────────────────────────────────────────────────────
export type SliceMethod = 'weight' | 'dimensions';

export interface SliceConfig {
  method: SliceMethod;
  weightG: number;
  sliceWidthCm: number;
  sliceLengthCm: number;
}

// ─── Output types ─────────────────────────────────────────────────────────────
export interface IngredientLine {
  id: IngredientId;
  label: string;
  totalNeeded: number;
  unit: 'g' | 'ml';
  packsNeeded: number;
  packSize: number;
  packPrice: number;
  bulkDiscountActive: boolean;
  totalCost: number;
  leftover: number;
  isTopping: boolean;
}

export interface ShoppingList {
  lines: IngredientLine[];
  grandTotal: number;
}

export interface PerPlateStats {
  scalingFactor: number;
  cakeWeightG: number;
  totalKcal: number;
  costRetail: number;
  costGastro: number;
  amountsPerPlate: Record<IngredientId, number>;
}

export interface PerSliceStats {
  slicesPerPlate: number;
  kcalPerSlice: number;
  pricePerSliceRetail: number;
  pricePerSliceGastro: number;
}

export interface BudgetResult {
  platesCount: number;
  shoppingList: ShoppingList;
  perSlice: PerSliceStats;
  budgetRemaining: number;
}
