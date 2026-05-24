import type { RecipeDefinition, BudgetResult, IngredientId, PriceTier, RecipeConfig } from '../types';
import { getAllIngredients } from '../recipeUtils';

interface BatchInfo {
  litersPerPlate: number;
  platesPerBatch: number;
  batches: number;
  lastBatchPlates: number;
  fullBatches: number;
}

interface Props {
  recipe: RecipeDefinition;
  budget: number;
  onBudgetChange: (b: number) => void;
  result: BudgetResult;
  tier: PriceTier;
  totalSlices: number;
  batchInfo: BatchInfo;
  amountsPerPlate: Record<IngredientId, number>;
  recipeConfig: RecipeConfig;
}

function fmtEur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function fmtAmt(amount: number, unit: 'g' | 'ml') {
  if (unit === 'ml') return amount >= 1000 ? `${(amount / 1000).toFixed(2)} L` : `${Math.round(amount)} ml`;
  return amount >= 1000 ? `${(amount / 1000).toFixed(2)} kg` : `${Math.round(amount)} g`;
}

export function BudgetCalculator({ recipe, budget, onBudgetChange, result, tier, totalSlices, batchInfo, amountsPerPlate, recipeConfig }: Props) {
  const spent = budget - result.budgetRemaining;
  const remaining = result.budgetRemaining;

  const allIngs = getAllIngredients(recipe);
  const batchScale = Math.min(batchInfo.platesPerBatch, result.platesCount);

  const wpIng = recipe.ingredients.find(i => i.role === 'weight_pct');
  const batterLines = allIngs.filter(i =>
    !i.isTopping &&
    i.role !== 'weight_pct' &&
    (i.role !== 'optional_toggle' || recipeConfig.enabledToggles.includes(i.id))
  );
  const toppingLines = recipe.topping ? allIngs.filter(i => i.isTopping) : [];

  const batterWeightGPerPlate = allIngs
    .filter(i => !i.isTopping && i.unit === 'g')
    .reduce((s, i) => s + (amountsPerPlate[i.id] ?? 0), 0);
  const toppingWeightGPerPlate = recipe.topping
    ? allIngs.filter(i => i.isTopping && i.unit === 'g')
        .reduce((s, i) => s + (amountsPerPlate[i.id] ?? 0) * (recipeConfig.toppingPercent / 100), 0)
    : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
      <h2 className="text-base font-semibold text-gray-900">Budget-Kalkulator</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">€</span>
          <input
            type="number" min="0" step="10"
            value={budget}
            onChange={(e) => onBudgetChange(Math.max(0, parseFloat(e.target.value) || 0))}
            className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Berechnung auf Basis: {tier === 'retail' ? 'Einzelhandel' : 'Gastro (Metro)'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-50 rounded-xl p-4 text-center">
          <div className="text-4xl font-bold text-amber-700">{result.platesCount}</div>
          <div className="text-xs font-medium text-amber-600 mt-0.5">
            {result.platesCount === 1 ? 'Blech' : 'Bleche'}
          </div>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 text-center">
          <div className="text-4xl font-bold text-amber-700">{totalSlices}</div>
          <div className="text-xs font-medium text-amber-600 mt-0.5">Scheiben gesamt</div>
        </div>
      </div>

      {result.platesCount > 0 && (
        <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-blue-700 font-medium">Teig-Portionen (Schüssel)</span>
            <div className="flex items-center gap-1">
              {batchInfo.fullBatches > 0 && (
                <span className="bg-blue-200 text-blue-900 text-xs font-bold px-2 py-0.5 rounded-full">
                  {batchInfo.fullBatches}× {batchInfo.platesPerBatch} {batchInfo.platesPerBatch === 1 ? 'Blech' : 'Bleche'}
                </span>
              )}
              {batchInfo.lastBatchPlates !== batchInfo.platesPerBatch && batchInfo.lastBatchPlates > 0 && (
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full">
                  1× {batchInfo.lastBatchPlates} {batchInfo.lastBatchPlates === 1 ? 'Blech' : 'Bleche'}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-blue-600 text-xs">
            <span>{batchInfo.litersPerPlate.toFixed(2)} L/Blech</span>
            <span>{fmtAmt(batterWeightGPerPlate, 'g')} Teig/Blech</span>
            {toppingWeightGPerPlate > 0 && (
              <span>{fmtAmt(toppingWeightGPerPlate, 'g')} Streusel/Blech</span>
            )}
          </div>
        </div>
      )}

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Einkauf</span>
          <span className="font-semibold text-gray-900">{fmtEur(spent)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Verbleibend</span>
          <span className={`font-semibold ${remaining >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {fmtEur(remaining)}
          </span>
        </div>
        {result.perSlice.slicesPerPlate > 0 && result.platesCount > 0 && (
          <div className="flex justify-between pt-1 border-t border-gray-100">
            <span className="text-gray-500">Kosten/Scheibe</span>
            <span className="font-semibold text-gray-700">
              {fmtEur(tier === 'retail' ? result.perSlice.pricePerSliceRetail : result.perSlice.pricePerSliceGastro)}
            </span>
          </div>
        )}
      </div>

      {result.platesCount > 0 && (
        <details className="border-t border-gray-100 pt-3">
          <summary className="text-sm font-medium text-gray-700 cursor-pointer select-none">
            Rezept pro Portion ({batchInfo.platesPerBatch} {batchInfo.platesPerBatch === 1 ? 'Blech' : 'Bleche'})
          </summary>
          <div className="mt-2 space-y-3 text-xs">
            <div>
              <p className="font-semibold text-gray-500 uppercase tracking-wide mb-1">Teig</p>
              <ul className="space-y-0.5">
                {batterLines.map(ing => {
                  const amount = (amountsPerPlate[ing.id] ?? 0) * batchScale;
                  if (amount === 0) return null;
                  return (
                    <li key={ing.id} className="flex justify-between text-gray-700">
                      <span>{ing.label.replace(/ \([^)]+\)$/, '')}</span>
                      <span className="font-medium">{fmtAmt(amount, ing.unit)}</span>
                    </li>
                  );
                })}
                {recipe.batter.extraLiquidPerBatchMl != null && recipe.batter.extraLiquidPerBatchMl > 0 && (
                  <li className="flex justify-between text-gray-700">
                    <span>{recipe.batter.extraLiquidLabel ?? 'Zusatzflüssigkeit'}</span>
                    <span className="font-medium">{fmtAmt(recipe.batter.extraLiquidPerBatchMl * batchScale, 'ml')}</span>
                  </li>
                )}
                {wpIng && (
                  <li className="flex justify-between text-gray-700 pt-0.5 border-t border-gray-100">
                    <span>{wpIng.label}</span>
                    <span className="font-medium">{fmtAmt((amountsPerPlate[wpIng.id] ?? 0) * batchScale, wpIng.unit as 'g' | 'ml')}</span>
                  </li>
                )}
              </ul>
            </div>
            {recipe.topping && recipeConfig.toppingPercent > 0 && toppingLines.length > 0 && (
              <div>
                <p className="font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  {recipe.topping.label} ({recipeConfig.toppingPercent}% der Bleche)
                </p>
                <ul className="space-y-0.5">
                  {toppingLines.map(ing => {
                    const amount = (amountsPerPlate[ing.id] ?? 0) * (recipeConfig.toppingPercent / 100) * batchScale;
                    if (amount === 0) return null;
                    return (
                      <li key={ing.id} className="flex justify-between text-gray-700">
                        <span>{ing.label.replace(/ \([^)]+\)$/, '')}</span>
                        <span className="font-medium">{fmtAmt(amount, ing.unit)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {recipe.steps && recipe.steps.length > 0 && (
              <div>
                <p className="font-semibold text-gray-500 uppercase tracking-wide mb-1">Zubereitung</p>
                <ol className="space-y-2">
                  {recipe.steps.map((step, i) => {
                    const stepAmounts = (step.ingredients ?? [])
                      .map(id => {
                        const ing = allIngs.find(x => x.id === id);
                        if (!ing) return null;
                        const raw = amountsPerPlate[id] ?? 0;
                        const amount = ing.isTopping
                          ? raw * (recipeConfig.toppingPercent / 100) * batchScale
                          : raw * batchScale;
                        if (amount === 0) return null;
                        return { id, label: ing.label.replace(/ \([^)]+\)$/, ''), amount, unit: ing.unit };
                      })
                      .filter(Boolean) as { id: string; label: string; amount: number; unit: 'g' | 'ml' }[];
                    return (
                      <li key={i} className="flex gap-2 text-gray-700">
                        <span className="font-bold text-amber-600 shrink-0">{i + 1}.</span>
                        <div>
                          <span>{step.description}</span>
                          {(step.temperatureCelsius || step.timeMinutes) && (
                            <span className="ml-1 text-gray-400">
                              {step.temperatureCelsius && `${step.temperatureCelsius}°C`}
                              {step.temperatureCelsius && step.timeMinutes && ' · '}
                              {step.timeMinutes && `${step.timeMinutes} min`}
                            </span>
                          )}
                          {stepAmounts.length > 0 && (
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {stepAmounts.map(a => (
                                <span key={a.id} className="bg-amber-50 text-amber-700 text-xs px-1.5 py-0.5 rounded">
                                  {a.label}: {fmtAmt(a.amount, a.unit)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
