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


export function PriceTable({ recipe, prices, tier, onTierChange, onPricesChange }: Props) {
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

      <div className="space-y-1">
        {ingredients.map((ing) => {
          const p = prices[ing.id][tier];
          const unitLabel = ing.unit === 'ml' ? '/L' : '/kg';
          return (
            <div
              key={ing.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${
                ing.isTopping ? 'bg-amber-50' : 'bg-gray-50'
              } ${ing.role === 'optional_toggle' ? 'opacity-60' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <span className={`text-xs font-medium truncate ${ing.isTopping ? 'text-amber-800' : 'text-gray-800'}`}>
                  {ing.isTopping && <span className="text-amber-400 mr-0.5">▸</span>}
                  {ing.label.replace(/ \([^)]+\)$/, '')}
                  {ing.role === 'optional_toggle' && <span className="ml-1 text-gray-400 text-[10px]">opt.</span>}
                </span>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {fmtEur(p.pricePerUnit)}{unitLabel}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number" min="1"
                  value={p.packSize}
                  onChange={(e) => updatePrice(ing.id, 'packSize', Math.max(1, parseFloat(e.target.value) || 1))}
                  className="w-16 border border-gray-200 rounded px-1.5 py-1 text-right text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                />
                <span className="text-gray-400 text-xs w-5">{ing.unit}</span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <span className="text-gray-400 text-xs">€</span>
                <input
                  type="number" min="0" step="0.01"
                  value={p.packPrice}
                  onChange={(e) => updatePrice(ing.id, 'packPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-16 border border-gray-200 rounded px-1.5 py-1 text-right text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                />
              </div>
            </div>
          );
        })}
      </div>

      {recipe.topping && (
        <p className="text-[10px] text-gray-400 mt-2">▸ {recipe.topping.label}</p>
      )}
    </div>
  );
}
