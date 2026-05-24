import type { BudgetResult, PerPlateStats, PerSliceStats, PriceTier } from '../types';

interface Props {
  result: BudgetResult;
  perPlate: PerPlateStats;
  perSlice: PerSliceStats;
  tier: PriceTier;
  budget: number;
  totalSlices: number;
  actualCostPerPlate: number | null;
}

function fmtEur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function fmtAmount(amount: number, unit: 'g' | 'ml') {
  if (unit === 'ml') {
    return amount >= 1000 ? `${(amount / 1000).toFixed(2)} L` : `${Math.round(amount)} ml`;
  }
  return amount >= 1000 ? `${(amount / 1000).toFixed(2)} kg` : `${Math.round(amount)} g`;
}

export function ResultsPanel({ result, perPlate, perSlice, tier, budget, totalSlices, actualCostPerPlate }: Props) {
  const { shoppingList, platesCount } = result;
  const activeCost = actualCostPerPlate ?? (tier === 'retail' ? perPlate.costRetail : perPlate.costGastro);
  const activeSlicePrice = actualCostPerPlate != null && perSlice.slicesPerPlate > 0
    ? actualCostPerPlate / perSlice.slicesPerPlate
    : (tier === 'retail' ? perSlice.pricePerSliceRetail : perSlice.pricePerSliceGastro);

  return (
    <div className="space-y-4">
      <details className="bg-white rounded-xl shadow-sm border border-gray-200">
        <summary className="px-4 py-3 font-semibold text-gray-900 cursor-pointer select-none flex items-center justify-between gap-2">
          <span className="shrink-0">Pro Blech &amp; Scheibe</span>
          <span className="text-amber-600 font-bold text-sm text-right">{fmtEur(activeCost)} / Blech · {fmtEur(activeSlicePrice)} / Scheibe</span>
        </summary>
        <div className="px-4 pb-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Pro Blech</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Stat label="Skalierungsfaktor" value={`×${perPlate.scalingFactor.toFixed(2)}`} />
              <Stat label="Gesamtgewicht" value={fmtAmount(perPlate.cakeWeightG, 'g')} />
              <Stat label="Kalorien" value={`${Math.round(perPlate.totalKcal).toLocaleString('de-DE')} kcal`} />
              <Stat label="Scheiben" value={`${perSlice.slicesPerPlate}`} />
              <Stat label="Kosten Einzelhandel" value={fmtEur(perPlate.costRetail)} active={tier === 'retail'} />
              <Stat label="Kosten Gastro" value={fmtEur(perPlate.costGastro)} active={tier === 'gastro'} />
              {actualCostPerPlate != null && (
                <Stat label="Ø Einkauf/Blech" value={fmtEur(actualCostPerPlate)} active={true} />
              )}
            </div>
          </div>
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Pro Scheibe</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Stat label="Kalorien" value={`${Math.round(perSlice.kcalPerSlice)} kcal`} />
              <Stat label="" value="" />
              <Stat label="Preis Einzelhandel" value={fmtEur(perSlice.pricePerSliceRetail)} active={tier === 'retail'} />
              <Stat label="Preis Gastro" value={fmtEur(perSlice.pricePerSliceGastro)} active={tier === 'gastro'} />
            </div>
          </div>
        </div>
      </details>

      <details open className="bg-white rounded-xl shadow-sm border border-gray-200">
        <summary className="px-4 py-3 font-semibold text-gray-900 cursor-pointer select-none flex items-center justify-between gap-2">
          <span className="shrink-0">
            Einkaufsliste
            {platesCount > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                {platesCount} {platesCount === 1 ? 'Blech' : 'Bleche'} · {totalSlices} Scheiben
              </span>
            )}
          </span>
          <span className="text-amber-600 font-bold text-sm">{fmtEur(shoppingList.grandTotal)}</span>
        </summary>
        <div className="px-4 pb-4">
          {shoppingList.lines.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">Budget eingeben, um die Einkaufsliste zu berechnen.</p>
          ) : (
            <>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs min-w-[320px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-1.5 pl-1 font-medium text-gray-400">Zutat</th>
                      <th className="text-right py-1.5 font-medium text-gray-400 hidden sm:table-cell">Benötigt</th>
                      <th className="text-right py-1.5 font-medium text-gray-400">Packg.</th>
                      <th className="text-right py-1.5 font-medium text-gray-400 hidden sm:table-cell">Packgr.</th>
                      <th className="text-right py-1.5 font-medium text-gray-400 hidden sm:table-cell">€/Pack</th>
                      <th className="text-right py-1.5 font-medium text-gray-400">Gesamt</th>
                      <th className="text-right py-1.5 pr-1 font-medium text-gray-400 hidden sm:table-cell">Rest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shoppingList.lines.map((line) => (
                      <tr
                        key={line.id}
                        className={`border-b border-gray-50 ${line.isTopping ? 'bg-amber-50/50' : ''}`}
                      >
                        <td className={`py-1.5 pl-1 pr-1 ${line.isTopping ? 'text-amber-800' : 'text-gray-800'} leading-tight`}>
                          {line.isTopping && <span className="text-amber-300 mr-0.5">▸</span>}
                          <span className="break-words">{line.label.replace(/ \([^)]+\)$/, '')}</span>
                          {line.bulkDiscountActive && (
                            <span className="ml-1 text-[10px] font-semibold text-green-700 bg-green-100 px-1 py-0.5 rounded whitespace-nowrap">Rabatt</span>
                          )}
                        </td>
                        <td className="text-right py-1.5 pr-1.5 text-gray-600 hidden sm:table-cell">
                          {fmtAmount(line.totalNeeded, line.unit)}
                        </td>
                        <td className="text-right py-1.5 pr-1.5 font-bold text-gray-900">
                          {line.packsNeeded}×
                        </td>
                        <td className="text-right py-1.5 pr-1.5 text-gray-400 hidden sm:table-cell">
                          {fmtAmount(line.packSize, line.unit)}
                        </td>
                        <td className="text-right py-1.5 pr-1.5 text-gray-400 hidden sm:table-cell">
                          {fmtEur(line.packPrice)}
                        </td>
                        <td className="text-right py-1.5 pr-1.5 font-semibold text-gray-900">
                          {fmtEur(line.totalCost)}
                        </td>
                        <td className={`text-right py-1.5 pr-1 hidden sm:table-cell ${line.leftover > line.packSize * 0.5 ? 'text-orange-500' : 'text-gray-300'}`}>
                          {line.leftover > 0 ? `+${fmtAmount(line.leftover, line.unit)}` : '–'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex justify-between font-bold text-sm mb-1">
                  <span>Gesamtkosten</span>
                  <span>{fmtEur(shoppingList.grandTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Verbleibendes Budget</span>
                  <span className={`font-semibold ${result.budgetRemaining >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmtEur(result.budgetRemaining)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>Budget gesamt</span>
                  <span>{fmtEur(budget)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </details>
    </div>
  );
}

function Stat({ label, value, active }: { label: string; value: string; active?: boolean }) {
  if (!label) return <div />;
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`font-semibold ${active === false ? 'text-gray-400' : 'text-gray-900'}`}>{value}</div>
    </div>
  );
}
