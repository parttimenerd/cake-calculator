import type {
  RecipeDefinition, RecipeConfig, PlateConfig, SliceConfig,
  PriceTable, PriceTier, PerPlateStats, PerSliceStats,
  ShoppingList, IngredientLine, BudgetResult, IngredientId,
} from './types';
import { getAllIngredients, getBatterWeightG, getDefaultPlateConfig, getPlateConfig } from './recipeUtils';

export function getScalingFactor(recipe: RecipeDefinition, _config: RecipeConfig, plateConfig: PlateConfig): number {
  const defaultPlate = getDefaultPlateConfig(recipe);
  const standardArea = defaultPlate.widthCm * defaultPlate.lengthCm;
  return (plateConfig.widthCm * plateConfig.lengthCm) / standardArea;
}

export function getBatterLitersPerPlate(recipe: RecipeDefinition, config: RecipeConfig, plateConfig: PlateConfig): number {
  const scale = getScalingFactor(recipe, config, plateConfig);
  return (recipe.batter.baseMl * scale) / 1000;
}

export function getBatchInfo(numPlates: number, recipe: RecipeDefinition, config: RecipeConfig, plateConfig: PlateConfig) {
  const litersPerPlate = getBatterLitersPerPlate(recipe, config, plateConfig);
  const platesPerBatch = Math.max(1, Math.floor(config.bowlLiters / litersPerPlate));
  const batches = numPlates > 0 ? Math.ceil(numPlates / platesPerBatch) : 0;
  const lastBatchPlates = numPlates > 0 ? numPlates - (batches - 1) * platesPerBatch : 0;
  const fullBatches = lastBatchPlates === platesPerBatch ? batches : batches - 1;
  return { litersPerPlate, platesPerBatch, batches, lastBatchPlates, fullBatches };
}

export function getAmountsPerPlate(recipe: RecipeDefinition, config: RecipeConfig, plateConfig: PlateConfig): Record<IngredientId, number> {
  const scale = getScalingFactor(recipe, config, plateConfig);
  const mults = config.ingredientMultipliers ?? {};
  const batterWeightG = getBatterWeightG(recipe);

  const amounts = {} as Record<IngredientId, number>;
  for (const ing of getAllIngredients(recipe)) {
    if (ing.role === 'weight_pct') {
      const mWp = mults[ing.id] ?? 1.0;
      const pct = Math.min(config.weightPctValue * mWp, 99.9);
      amounts[ing.id] = pct > 0 ? (batterWeightG * scale * pct) / (100 - pct) : 0;
    } else if (ing.role === 'optional_toggle') {
      amounts[ing.id] = config.enabledToggles.includes(ing.id)
        ? ing.baseAmount * scale * (mults[ing.id] ?? 1.0)
        : 0;
    } else {
      amounts[ing.id] = ing.baseAmount * scale * (mults[ing.id] ?? 1.0);
    }
  }
  return amounts;
}

function costForAmount(id: IngredientId, amount: number, prices: PriceTable, tier: PriceTier): number {
  const p = prices[id][tier];
  return (amount / p.packSize) * p.packPrice;
}

export function getPerPlateStats(recipe: RecipeDefinition, config: RecipeConfig, plateConfig: PlateConfig, prices: PriceTable): PerPlateStats {
  const amounts = getAmountsPerPlate(recipe, config, plateConfig);
  const scale = getScalingFactor(recipe, config, plateConfig);
  let cakeWeightG = 0;
  let totalKcal = 0;
  let costRetail = 0;
  let costGastro = 0;

  for (const ing of getAllIngredients(recipe)) {
    const amount = amounts[ing.id];
    if (amount === 0) continue;
    const fraction = ing.isTopping ? config.toppingPercent / 100 : 1;
    const effectiveAmount = amount * fraction;

    if (ing.unit === 'g') cakeWeightG += effectiveAmount;
    totalKcal += effectiveAmount * ing.kcalPerUnit;
    costRetail += costForAmount(ing.id, effectiveAmount, prices, 'retail');
    costGastro += costForAmount(ing.id, effectiveAmount, prices, 'gastro');
  }

  return { scalingFactor: scale, cakeWeightG, totalKcal, costRetail, costGastro, amountsPerPlate: amounts };
}

export function buildShoppingList(recipe: RecipeDefinition, numPlates: number, config: RecipeConfig, plateConfig: PlateConfig, prices: PriceTable, tier: PriceTier): ShoppingList {
  const amounts = getAmountsPerPlate(recipe, config, plateConfig);
  const lines: IngredientLine[] = [];
  let grandTotal = 0;

  for (const ing of getAllIngredients(recipe)) {
    if (ing.isTopping && config.toppingPercent === 0) continue;

    const amountPerPlate = amounts[ing.id];
    if (amountPerPlate === 0) continue;

    const fraction = ing.isTopping ? config.toppingPercent / 100 : 1;
    const totalNeeded = amountPerPlate * fraction * numPlates;
    if (totalNeeded === 0) continue;

    const p = prices[ing.id][tier];
    const packsNeeded = Math.ceil(totalNeeded / p.packSize);
    const bulkDiscountActive = !!(p.bulkDiscount && packsNeeded > p.bulkDiscount.minPacks);
    const effectivePackPrice = bulkDiscountActive ? p.bulkDiscount!.packPrice : p.packPrice;
    const totalCost = packsNeeded * effectivePackPrice;
    const leftover = packsNeeded * p.packSize - totalNeeded;

    lines.push({
      id: ing.id,
      label: ing.label,
      totalNeeded,
      unit: ing.unit,
      packsNeeded,
      packSize: p.packSize,
      packPrice: effectivePackPrice,
      bulkDiscountActive,
      totalCost,
      leftover,
      isTopping: ing.isTopping,
    });

    grandTotal += totalCost;
  }

  return { lines, grandTotal };
}

export function calculateMaxPlates(recipe: RecipeDefinition, budget: number, config: RecipeConfig, plateConfig: PlateConfig, prices: PriceTable, tier: PriceTier): BudgetResult {
  if (budget <= 0) {
    const emptyList = buildShoppingList(recipe, 0, config, plateConfig, prices, tier);
    const perSlice: PerSliceStats = { slicesPerPlate: 0, kcalPerSlice: 0, pricePerSliceRetail: 0, pricePerSliceGastro: 0 };
    return { platesCount: 0, shoppingList: emptyList, perSlice, budgetRemaining: budget };
  }

  const perPlate = getPerPlateStats(recipe, config, plateConfig, prices);
  const roughCostPerPlate = tier === 'retail' ? perPlate.costRetail : perPlate.costGastro;
  if (roughCostPerPlate <= 0) {
    return { platesCount: 0, shoppingList: buildShoppingList(recipe, 0, config, plateConfig, prices, tier), perSlice: { slicesPerPlate: 0, kcalPerSlice: 0, pricePerSliceRetail: 0, pricePerSliceGastro: 0 }, budgetRemaining: budget };
  }

  let n = Math.max(1, Math.floor(budget / roughCostPerPlate));
  const MAX = 2000;

  while (n > 0) {
    const list = buildShoppingList(recipe, n, config, plateConfig, prices, tier);
    if (list.grandTotal <= budget) break;
    n--;
  }

  while (n < MAX) {
    const next = buildShoppingList(recipe, n + 1, config, plateConfig, prices, tier);
    if (next.grandTotal > budget) break;
    n++;
  }

  const shoppingList = buildShoppingList(recipe, n, config, plateConfig, prices, tier);
  return {
    platesCount: n,
    shoppingList,
    perSlice: { slicesPerPlate: 0, kcalPerSlice: 0, pricePerSliceRetail: 0, pricePerSliceGastro: 0 },
    budgetRemaining: budget - shoppingList.grandTotal,
  };
}

export function getSlicesPerPlate(plateConfig: PlateConfig, sliceConfig: SliceConfig, cakeWeightG: number): number {
  if (sliceConfig.method === 'weight') {
    if (sliceConfig.weightG <= 0) return 0;
    return Math.floor(cakeWeightG / sliceConfig.weightG);
  }
  const plateArea = plateConfig.widthCm * plateConfig.lengthCm;
  const sliceArea = sliceConfig.sliceWidthCm * sliceConfig.sliceLengthCm;
  if (sliceArea <= 0) return 0;
  return Math.floor(plateArea / sliceArea);
}

export function getPerSliceStats(perPlate: PerPlateStats, slicesPerPlate: number): PerSliceStats {
  if (slicesPerPlate <= 0) {
    return { slicesPerPlate: 0, kcalPerSlice: 0, pricePerSliceRetail: 0, pricePerSliceGastro: 0 };
  }
  return {
    slicesPerPlate,
    kcalPerSlice: perPlate.totalKcal / slicesPerPlate,
    pricePerSliceRetail: perPlate.costRetail / slicesPerPlate,
    pricePerSliceGastro: perPlate.costGastro / slicesPerPlate,
  };
}

// Re-export for convenience
export { getPlateConfig };
