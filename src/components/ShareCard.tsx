import type { RecipeDefinition, RecipeConfig, PlateConfig, SliceConfig, PriceTier, IngredientId } from '../types';
import { ALL_RECIPES } from '../recipes';
import { getDefaultPrices, getAllIngredients } from '../recipeUtils';
import { getAmountsPerPlate, getBatchInfo, getPerPlateStats, getSlicesPerPlate } from '../calculator';

export interface SharePayload {
  v: 1;
  recipeId: string;
  plateCount: number;
  slices: number;
  multipliers: Partial<Record<IngredientId, number>>;
  config: RecipeConfig;
  plateConfig: PlateConfig;
  sliceConfig: SliceConfig | null;
  tier: PriceTier;
}

function fmtAmt(amount: number, unit: 'g' | 'ml') {
  if (unit === 'ml') return amount >= 1000 ? `${(amount / 1000).toFixed(2)} L` : `${Math.round(amount)} ml`;
  return amount >= 1000 ? `${(amount / 1000).toFixed(2)} kg` : `${Math.round(amount)} g`;
}

export function ShareCard({ payload }: { payload: SharePayload }) {
  const recipe = ALL_RECIPES.find(r => r.id === payload.recipeId);
  if (!recipe) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl shadow border border-gray-200 p-6 max-w-sm text-center">
          <p className="text-gray-500">Rezept nicht gefunden: <code>{payload.recipeId}</code></p>
          <a href={window.location.href.split('#')[0]} className="mt-4 inline-block text-amber-600 hover:underline">
            Zum Rechner
          </a>
        </div>
      </div>
    );
  }

  return <ShareCardContent recipe={recipe} payload={payload} />;
}

function ShareCardContent({ recipe, payload }: { recipe: RecipeDefinition; payload: SharePayload }) {
  const { config, plateConfig, tier, plateCount } = payload;
  const prices = getDefaultPrices(recipe);
  const perPlate = getPerPlateStats(recipe, config, plateConfig, prices);

  const totalSlices = payload.sliceConfig
    ? plateCount * getSlicesPerPlate(plateConfig, payload.sliceConfig, perPlate.cakeWeightG)
    : 0;

  const batchInfo = getBatchInfo(plateCount, recipe, config, plateConfig);
  const amountsPerPlate = getAmountsPerPlate(recipe, config, plateConfig);

  const allIngs = getAllIngredients(recipe);
  const wpIng = recipe.ingredients.find(i => i.role === 'weight_pct');
  const batterLines = allIngs.filter(i =>
    !i.isTopping &&
    i.role !== 'weight_pct' &&
    (i.role !== 'optional_toggle' || config.enabledToggles.includes(i.id))
  );
  const toppingLines = recipe.topping ? allIngs.filter(i => i.isTopping) : [];
  const batchScale = batchInfo.platesPerBatch;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-amber-700 text-white shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold">
            {recipe.source ? (
              <a href={recipe.source} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {recipe.name}
              </a>
            ) : recipe.name}
          </h1>
          <p className="text-amber-200 text-sm">{recipe.description ?? 'Einkaufsliste'}</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <StatCard label="Bleche" value={String(plateCount)} />
            {totalSlices > 0 && <StatCard label="Scheiben" value={String(totalSlices)} />}
            <StatCard label="Teig-Portionen" value={`${batchInfo.batches}×`} />
          </div>

          <p className="text-xs text-gray-400 text-center">
            {batchInfo.platesPerBatch} {batchInfo.platesPerBatch === 1 ? 'Blech' : 'Bleche'}/Portion ·{' '}
            Preisniveau: {tier === 'retail' ? 'Einzelhandel' : 'Gastro'}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">
            Rezept pro Portion ({batchInfo.platesPerBatch} {batchInfo.platesPerBatch === 1 ? 'Blech' : 'Bleche'})
          </h2>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Teig</p>
            <ul className="space-y-0.5 text-sm">
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

          {recipe.topping && config.toppingPercent > 0 && toppingLines.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                {recipe.topping.label} ({Math.round(config.toppingPercent)}% der Bleche)
              </p>
              <ul className="space-y-0.5 text-sm">
                {toppingLines.map(ing => {
                  const amount = (amountsPerPlate[ing.id] ?? 0) * (config.toppingPercent / 100) * batchScale;
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
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Zubereitung</p>
              <ol className="space-y-1">
                {recipe.steps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700">
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
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <div className="text-center">
          <a
            href={window.location.href.split('#')[0]}
            className="text-sm text-amber-600 hover:underline"
          >
            Zurück zum Rechner
          </a>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-amber-50 rounded-xl p-3 text-center">
      <div className="text-3xl font-bold text-amber-700">{value}</div>
      <div className="text-xs font-medium text-amber-600 mt-0.5">{label}</div>
    </div>
  );
}
