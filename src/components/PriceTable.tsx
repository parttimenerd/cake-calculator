import type { RecipeDefinition, PriceTable, PriceTier, IngredientId } from '../types';
import { getAllIngredients, getDefaultPrices } from '../recipeUtils';

interface Props {
  recipe: RecipeDefinition;
  prices: PriceTable;
  tier: PriceTier;
  onTierChange: (t: PriceTier) => void;
  onPricesChange: (p: PriceTable) => void;
}

function fmtEur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function fmtAmount(amount: number, unit: 'g' | 'ml'): string {
  if (unit === 'ml') return amount >= 1000 ? `${amount / 1000} L` : `${amount} ml`;
  return amount >= 1000 ? `${amount / 1000} kg` : `${amount} g`;
}

export function PriceTable({ recipe, prices, tier, onTierChange, onPricesChange }: Props) {
  const otherTier: PriceTier = tier === 'retail' ? 'gastro' : 'retail';
  const ingredients = getAllIngredients(recipe);

  const updatePrice = (id: IngredientId, field: 'packSize' | 'packPrice', value: number) => {
    const updated = { ...prices, [id]: { ...prices[id] } };
    const p = { ...updated[id][tier], [field]: value };
    p.pricePerUnit = p.packSize > 0 ? (p.packPrice / p.packSize) * 1000 : 0;
    updated[id] = { ...updated[id], [tier]: p };
    onPricesChange(updated);
  };

  const handleReset = () => onPricesChange(getDefaultPrices(recipe));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900">Preise</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
          >
            Zurücksetzen
          </button>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(['retail', 'gastro'] as const).map((t) => (
              <button
                key={t}
                onClick={() => onTierChange(t)}
                className={`px-3 py-1 font-medium transition-colors ${
                  tier === t ? 'bg-amber-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                {t === 'retail' ? 'Einzelhandel' : 'Gastro'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm min-w-[340px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-1.5 pl-1 font-medium text-gray-500">Zutat</th>
              <th className="text-right py-1.5 font-medium text-gray-500">Pack</th>
              <th className="text-right py-1.5 font-medium text-gray-500">€/Pack</th>
              <th className="text-right py-1.5 pr-1 font-medium text-gray-500 hidden sm:table-cell whitespace-nowrap">€/kg · /L</th>
            </tr>
          </thead>
          <tbody>
            {ingredients.map((ing) => {
              const p = prices[ing.id][tier];
              const pOther = prices[ing.id][otherTier];
              const unitLabel = ing.unit === 'ml' ? '/L' : '/kg';
              return (
                <tr key={ing.id} className={`border-b border-gray-50 ${ing.isTopping ? 'bg-amber-50/40' : ''} ${ing.role === 'optional_toggle' ? 'opacity-60' : ''}`}>
                  <td className={`py-1.5 pl-1 pr-2 text-xs ${ing.isTopping ? 'text-amber-800' : 'text-gray-800'}`}>
                    {ing.isTopping && <span className="text-amber-300 mr-0.5">▸</span>}
                    <span className="leading-tight">
                      {ing.label.replace(/ \([^)]+\)$/, '')}
                    </span>
                    {ing.role === 'optional_toggle' && <span className="ml-1 text-gray-400 text-[10px]">opt.</span>}
                  </td>
                  <td className="text-right py-1.5 pr-1.5">
                    <div className="flex items-center justify-end gap-0.5">
                      <input
                        type="number" min="1"
                        value={p.packSize}
                        onChange={(e) => updatePrice(ing.id, 'packSize', Math.max(1, parseFloat(e.target.value) || 1))}
                        className="w-16 border border-gray-200 rounded px-1 py-0.5 text-right text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                      <span className="text-gray-400 text-xs">{ing.unit}</span>
                    </div>
                  </td>
                  <td className="text-right py-1.5 pr-1.5">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number" min="0" step="0.01"
                        value={p.packPrice}
                        onChange={(e) => updatePrice(ing.id, 'packPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-16 border border-gray-200 rounded px-1 py-0.5 text-right text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                      <span className="text-gray-300 text-[10px] hidden sm:inline whitespace-nowrap">
                        {fmtEur(pOther.packPrice)}/{fmtAmount(pOther.packSize, ing.unit)}
                      </span>
                    </div>
                  </td>
                  <td className="text-right py-1.5 pr-1 text-gray-500 text-xs hidden sm:table-cell whitespace-nowrap">
                    {fmtEur(p.pricePerUnit)}{unitLabel}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        {recipe.topping ? `${recipe.topping.label} gelb · ` : ''}{otherTier === 'retail' ? 'Einzelhandel' : 'Gastro'}-Preis in grau
      </p>
    </div>
  );
}
