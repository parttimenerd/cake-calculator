import { useEffect, useMemo, useState } from 'react';
import type { PriceTier, RecipeConfig, PlateConfig, SliceConfig, PriceTable, IngredientId, RecipeDefinition } from './types';
import { ALL_RECIPES } from './recipes';
import {
  getDefaultRecipeConfig,
  getDefaultPrices,
  getDefaultPlateConfig,
} from './recipeUtils';
import {
  getPerPlateStats,
  getSlicesPerPlate,
  getPerSliceStats,
  calculateMaxPlates,
  getBatchInfo,
  getAmountsPerPlate,
} from './calculator';
import { RecipeConfigPanel } from './components/RecipeConfig';
import { PriceTable as PriceTablePanel } from './components/PriceTable';
import { SliceConfigPanel } from './components/SliceConfig';
import { BudgetCalculator } from './components/BudgetCalculator';
import { ResultsPanel } from './components/ResultsPanel';
import { Optimizer } from './components/Optimizer';
import { ShareCard } from './components/ShareCard';
import type { SharePayload } from './components/ShareCard';

const LS_VERSION = 'cake-calc-v3';

const DEFAULT_SLICE_CONFIG: SliceConfig = {
  method: 'dimensions',
  weightG: 100,
  sliceWidthCm: 6,
  sliceLengthCm: 8,
};

interface PerRecipeState {
  recipeConfig: RecipeConfig;
  plateConfig: PlateConfig;
  sliceConfig: SliceConfig;
  prices: PriceTable;
  tier: PriceTier;
  budget: number;
}

function lsKey(recipeId: string) {
  return `${LS_VERSION}-${recipeId}`;
}

function loadRecipeState(recipe: RecipeDefinition): PerRecipeState {
  const defaults: PerRecipeState = {
    recipeConfig: getDefaultRecipeConfig(recipe),
    plateConfig: getDefaultPlateConfig(recipe),
    sliceConfig: DEFAULT_SLICE_CONFIG,
    prices: getDefaultPrices(recipe),
    tier: 'retail',
    budget: 100,
  };
  try {
    const raw = localStorage.getItem(lsKey(recipe.id));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<PerRecipeState>;
    return {
      recipeConfig: { ...defaults.recipeConfig, ...(parsed.recipeConfig ?? {}) },
      plateConfig: parsed.plateConfig ?? defaults.plateConfig,
      sliceConfig: parsed.sliceConfig ?? defaults.sliceConfig,
      prices: parsed.prices ?? defaults.prices,
      tier: parsed.tier ?? defaults.tier,
      budget: parsed.budget ?? defaults.budget,
    };
  } catch {
    return defaults;
  }
}

function loadAllRecipeState(recipes: RecipeDefinition[]): Record<string, PerRecipeState> {
  const result: Record<string, PerRecipeState> = {};
  for (const r of recipes) result[r.id] = loadRecipeState(r);
  return result;
}

function parseShareHash(): SharePayload | null {
  const hash = window.location.hash;
  if (!hash.startsWith('#share=')) return null;
  try {
    const payload = JSON.parse(atob(hash.slice(7))) as SharePayload;
    if (payload.v !== 1 || !payload.recipeId) return null;
    return payload;
  } catch {
    return null;
  }
}

export default function App() {
  const [sharePayload] = useState<SharePayload | null>(() => parseShareHash());

  if (sharePayload) {
    return <ShareCard payload={sharePayload} />;
  }

  return <MainApp />;
}

function MainApp() {
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(ALL_RECIPES[0].id);
  const [perRecipeState, setPerRecipeState] = useState<Record<string, PerRecipeState>>(
    () => loadAllRecipeState(ALL_RECIPES)
  );

  const recipe = ALL_RECIPES.find(r => r.id === selectedRecipeId) ?? ALL_RECIPES[0];
  const state = perRecipeState[recipe.id];

  const mergedRecipeConfig = useMemo(
    () => ({ ...getDefaultRecipeConfig(recipe), ...state.recipeConfig }),
    [recipe, state.recipeConfig]
  );

  const setState = (patch: Partial<PerRecipeState>) => {
    setPerRecipeState(prev => ({
      ...prev,
      [recipe.id]: { ...prev[recipe.id], ...patch },
    }));
  };

  useEffect(() => {
    localStorage.setItem(lsKey(recipe.id), JSON.stringify({
      ...state,
      recipeConfig: mergedRecipeConfig,
    }));
  }, [recipe.id, state, mergedRecipeConfig]);

  const perPlate = useMemo(
    () => getPerPlateStats(recipe, mergedRecipeConfig, state.plateConfig, state.prices),
    [recipe, mergedRecipeConfig, state.plateConfig, state.prices]
  );

  const slicesPerPlate = useMemo(
    () => getSlicesPerPlate(state.plateConfig, state.sliceConfig, perPlate.cakeWeightG),
    [state.plateConfig, state.sliceConfig, perPlate.cakeWeightG]
  );

  const perSlice = useMemo(
    () => getPerSliceStats(perPlate, slicesPerPlate),
    [perPlate, slicesPerPlate]
  );

  const budgetResult = useMemo(() => {
    const r = calculateMaxPlates(recipe, state.budget, mergedRecipeConfig, state.plateConfig, state.prices, state.tier);
    return { ...r, perSlice };
  }, [recipe, state.budget, mergedRecipeConfig, state.plateConfig, state.prices, state.tier, perSlice]);

  const totalSlices = budgetResult.platesCount * slicesPerPlate;

  const batchInfo = useMemo(
    () => getBatchInfo(budgetResult.platesCount, recipe, mergedRecipeConfig, state.plateConfig),
    [budgetResult.platesCount, recipe, mergedRecipeConfig, state.plateConfig]
  );

  const amountsPerPlate = useMemo(
    () => getAmountsPerPlate(recipe, mergedRecipeConfig, state.plateConfig),
    [recipe, mergedRecipeConfig, state.plateConfig]
  );

  const actualCostPerPlate = budgetResult.platesCount > 0
    ? budgetResult.shoppingList.grandTotal / budgetResult.platesCount
    : null;

  function handleApplyMultipliers(multipliers: Partial<Record<IngredientId, number>>, toppingPercent: number) {
    setState({
      recipeConfig: {
        ...mergedRecipeConfig,
        ingredientMultipliers: multipliers,
        toppingPercent,
      },
    });
  }

  function handleResetMultipliers() {
    setState({ recipeConfig: { ...mergedRecipeConfig, ingredientMultipliers: {} } });
  }

  const hasMultipliers = Object.keys(mergedRecipeConfig.ingredientMultipliers ?? {}).length > 0;

  const handleRecipeChange = (id: string) => {
    setSelectedRecipeId(id);
    if (!perRecipeState[id]) {
      const newRecipe = ALL_RECIPES.find(r => r.id === id)!;
      setPerRecipeState(prev => ({ ...prev, [id]: loadRecipeState(newRecipe) }));
    }
  };

  const handlePlateConfigChange = (plateConfig: PlateConfig) => setState({ plateConfig });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-amber-700 text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold">
                {recipe.source ? (
                  <a href={recipe.source} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {recipe.name}
                  </a>
                ) : recipe.name}
              </h1>
              <p className="text-amber-200 text-sm">{recipe.description ?? 'Kostenkalkulation'}</p>
            </div>
            {ALL_RECIPES.length > 1 && (
              <select
                value={selectedRecipeId}
                onChange={e => handleRecipeChange(e.target.value)}
                className="mt-0.5 bg-amber-600 text-white border border-amber-500 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-300 cursor-pointer"
              >
                {ALL_RECIPES.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-5 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
        <div className="space-y-5">
          <RecipeConfigPanel
            recipe={recipe}
            config={mergedRecipeConfig}
            onChange={(c) => setState({ recipeConfig: c })}
            plateConfig={state.plateConfig}
            onPlateConfigChange={handlePlateConfigChange}
          />
          <SliceConfigPanel
            config={state.sliceConfig}
            onChange={(c) => setState({ sliceConfig: c })}
            plateConfig={state.plateConfig}
            slicesPerPlate={slicesPerPlate}
          />
          <BudgetCalculator
            recipe={recipe}
            budget={state.budget}
            onBudgetChange={(b) => setState({ budget: b })}
            result={budgetResult}
            tier={state.tier}
            totalSlices={totalSlices}
            batchInfo={batchInfo}
            amountsPerPlate={amountsPerPlate}
            recipeConfig={mergedRecipeConfig}
          />
        </div>

        <div className="space-y-5">
          <PriceTablePanel
            recipe={recipe}
            prices={state.prices}
            tier={state.tier}
            onTierChange={(t) => setState({ tier: t })}
            onPricesChange={(p) => setState({ prices: p })}
          />
          <ResultsPanel
            result={budgetResult}
            perPlate={perPlate}
            perSlice={perSlice}
            tier={state.tier}
            budget={state.budget}
            totalSlices={totalSlices}
            actualCostPerPlate={actualCostPerPlate}
          />
        </div>
      </main>

      <div className="max-w-5xl mx-auto px-4 pb-8">
        <Optimizer
          recipe={recipe}
          numPlates={budgetResult.platesCount}
          config={mergedRecipeConfig}
          plateConfig={state.plateConfig}
          prices={state.prices}
          tier={state.tier}
          onApply={handleApplyMultipliers}
          onReset={handleResetMultipliers}
          hasMultipliers={hasMultipliers}
        />
      </div>
    </div>
  );
}
