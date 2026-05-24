import type {
  RecipeDefinition, RecipeIngredient, RecipeConfig, PlateConfig,
  PriceTable, IngredientPrice, PlateId,
} from './types';

export function getAllIngredients(recipe: RecipeDefinition): RecipeIngredient[] {
  const normalize = (ing: typeof recipe.ingredients[0], isTopping: boolean): RecipeIngredient => ({
    id: ing.id,
    label: ing.label,
    baseAmount: ing.baseAmount,
    unit: ing.unit,
    kcalPerUnit: ing.kcalPerUnit,
    role: ing.role ?? 'normal',
    isTopping,
    toggleLabel: ing.toggleLabel,
    sliderMin: ing.sliderMin,
    sliderMax: ing.sliderMax,
  });

  return [
    ...recipe.ingredients.map(i => normalize(i, false)),
    ...(recipe.topping?.ingredients ?? []).map(i => normalize(i, true)),
  ];
}

export function getDefaultPrices(recipe: RecipeDefinition): PriceTable {
  const table: PriceTable = {} as PriceTable;

  const buildPrice = (entry: NonNullable<typeof recipe.ingredients[0]['prices']['retail']>): IngredientPrice => ({
    packSize: entry.packSize,
    packPrice: entry.packPrice,
    pricePerUnit: entry.packSize > 0 ? (entry.packPrice / entry.packSize) * 1000 : 0,
    bulkDiscount: entry.bulkDiscount,
  });

  const fallback = (other?: IngredientPrice): IngredientPrice =>
    other ?? { packSize: 1, packPrice: 0, pricePerUnit: 0 };

  for (const ing of getAllIngredients(recipe)) {
    const yamlIng = [...recipe.ingredients, ...(recipe.topping?.ingredients ?? [])].find(i => i.id === ing.id);
    if (!yamlIng) continue;
    const retail = yamlIng.prices.retail ? buildPrice(yamlIng.prices.retail) : undefined;
    const gastro = yamlIng.prices.gastro ? buildPrice(yamlIng.prices.gastro) : undefined;
    table[ing.id] = {
      retail: retail ?? fallback(gastro),
      gastro: gastro ?? fallback(retail),
    };
  }

  return table;
}

export function getDefaultPlateConfig(recipe: RecipeDefinition): PlateConfig {
  const plate = recipe.plates.find(p => p.default) ?? recipe.plates[0];
  return { widthCm: plate.widthCm, lengthCm: plate.lengthCm };
}

export function getPlateConfig(recipe: RecipeDefinition, plateId: PlateId): PlateConfig {
  const plate = recipe.plates.find(p => p.id === plateId) ?? recipe.plates.find(p => p.default) ?? recipe.plates[0];
  return { widthCm: plate.widthCm, lengthCm: plate.lengthCm };
}

export function getBatterWeightG(recipe: RecipeDefinition): number {
  return recipe.ingredients
    .filter(i => !i.role && i.unit === 'g')
    .reduce((sum, i) => sum + i.baseAmount, 0);
}

export function getDefaultRecipeConfig(recipe: RecipeDefinition): RecipeConfig {
  const defaultPlate = recipe.plates.find(p => p.default) ?? recipe.plates[0];

  // Derive default weightPctValue from the weight_pct ingredient's baseAmount
  const wpIng = recipe.ingredients.find(i => i.role === 'weight_pct');
  let weightPctValue = 0;
  if (wpIng) {
    const batterWeightG = getBatterWeightG(recipe);
    weightPctValue = batterWeightG > 0
      ? Math.round((wpIng.baseAmount / (batterWeightG + wpIng.baseAmount)) * 1000) / 10
      : 0;
  }

  return {
    plateId: defaultPlate.id,
    weightPctValue,
    toppingPercent: recipe.topping?.defaultPercent ?? 100,
    bowlLiters: 15,
    enabledToggles: [],
    ingredientMultipliers: {},
  };
}
