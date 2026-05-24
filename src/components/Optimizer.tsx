import { useState, useRef } from 'react';
import type { RecipeDefinition, RecipeConfig, PlateConfig, PriceTable, PriceTier, IngredientId } from '../types';
import { runGAAsync } from '../optimizer';
import type { GAResult } from '../optimizer';

interface Props {
  recipe: RecipeDefinition;
  numPlates: number;
  config: RecipeConfig;
  plateConfig: PlateConfig;
  prices: PriceTable;
  tier: PriceTier;
  onApply: (multipliers: Partial<Record<IngredientId, number>>, toppingPercent: number) => void;
  onReset: () => void;
  hasMultipliers: boolean;
}

function fmtEur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function fmtAmount(amount: number, unit: 'g' | 'ml') {
  if (unit === 'ml') return amount >= 1000 ? `${(amount / 1000).toFixed(2)} L` : `${Math.round(amount)} ml`;
  return amount >= 1000 ? `${(amount / 1000).toFixed(2)} kg` : `${Math.round(amount)} g`;
}

export function Optimizer({ recipe, numPlates, config, plateConfig, prices, tier, onApply, onReset, hasMultipliers }: Props) {
  const [toleranceNormal, setToleranceNormal] = useState(5);
  const [toleranceTopping, setToleranceTopping] = useState(15);
  const [toppingCountFlex, setToppingCountFlex] = useState(0);
  const [popSize, setPopSize] = useState(200);
  const [generations, setGenerations] = useState(300);
  const [penaltyFactor, setPenaltyFactor] = useState(3);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [bestFitness, setBestFitness] = useState<number | null>(null);
  const [results, setResults] = useState<GAResult[] | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [shareToast, setShareToast] = useState(false);

  const cancelRef = useRef(false);

  const showToppingFlex = recipe.topping != null &&
    config.toppingPercent > 0 && config.toppingPercent < 100;

  async function handleRun() {
    cancelRef.current = false;
    setRunning(true);
    setProgress(0);
    setBestFitness(null);
    setResults(null);
    setSelectedIdx(0);

    const res = await runGAAsync(
      {
        recipe,
        numPlates,
        config: { ...config, ingredientMultipliers: {} },
        plateConfig,
        prices,
        tier,
        toleranceNormal: toleranceNormal / 100,
        toleranceTopping: toleranceTopping / 100,
        toppingCountFlex,
        populationSize: popSize,
        generations,
        penaltyFactor,
        earlyStopGenerations: 50,
      },
      (gen, fitness) => {
        setProgress(Math.round((gen / generations) * 100));
        setBestFitness(fitness);
      },
    );

    setProgress(100);
    setResults(res);
    setRunning(false);
  }

  function handleShare(result: GAResult) {
    const payload = {
      v: 1,
      recipeId: recipe.id,
      plateCount: numPlates,
      slices: 0,
      multipliers: result.multipliers,
      config: { ...config, toppingPercent: result.toppingPercentUsed, ingredientMultipliers: result.multipliers },
      plateConfig,
      sliceConfig: null,
      tier,
    };
    const hash = '#share=' + btoa(JSON.stringify(payload));
    const url = window.location.href.split('#')[0] + hash;
    navigator.clipboard.writeText(url).catch(() => {});
    window.history.replaceState(null, '', hash);
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2000);
  }

  const disabled = numPlates === 0 || running;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-gray-900">Restmengen-Optimierer</h2>
          {hasMultipliers && (
            <button onClick={onReset} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
              Zurücksetzen
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          Genetischer Algorithmus — variiert Zutatenmengen, minimiert Verpackungsreste
        </p>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="space-y-3">
          <SliderField
            label="Toleranz Teig"
            value={toleranceNormal}
            min={1} max={20} step={1}
            display={`±${toleranceNormal}%`}
            minLabel="±1%" maxLabel="±20%"
            disabled={running}
            onChange={setToleranceNormal}
          />
          {recipe.topping && (
            <SliderField
              label="Toleranz Streusel"
              value={toleranceTopping}
              min={1} max={30} step={1}
              display={`±${toleranceTopping}%`}
              minLabel="±1%" maxLabel="±30%"
              disabled={running}
              onChange={setToleranceTopping}
            />
          )}
          {showToppingFlex && (
            <SliderField
              label="Varianz Streusel-Bleche"
              value={toppingCountFlex}
              min={0} max={5} step={1}
              display={toppingCountFlex === 0 ? 'aus' : `±${toppingCountFlex} Bleche`}
              minLabel="aus" maxLabel="±5"
              disabled={running}
              onChange={setToppingCountFlex}
            />
          )}
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-gray-400 hover:text-gray-600 select-none">Erweiterte Einstellungen</summary>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Population</label>
              <input type="number" min={50} max={500} step={50} value={popSize}
                onChange={e => setPopSize(Number(e.target.value))} disabled={running}
                className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-center" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Generationen</label>
              <input type="number" min={50} max={1000} step={50} value={generations}
                onChange={e => setGenerations(Number(e.target.value))} disabled={running}
                className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-center" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Kostenfaktor</label>
              <input type="number" min={1} max={10} step={1} value={penaltyFactor}
                onChange={e => setPenaltyFactor(Number(e.target.value))} disabled={running}
                className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-center" />
            </div>
          </div>
        </details>

        <button
          onClick={handleRun}
          disabled={disabled}
          className="w-full py-2 rounded-lg font-semibold text-sm transition-colors
            bg-amber-600 text-white hover:bg-amber-700
            disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          {running ? 'Optimierung läuft…' : numPlates === 0 ? 'Budget eingeben um zu optimieren' : 'Optimierung starten'}
        </button>

        {running && (
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Fortschritt</span>
              <span>{progress}% {bestFitness != null && `· Fitness: ${bestFitness.toFixed(3)}`}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-amber-500 h-2 rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {results && !running && (
          <div className="space-y-3">
            {results.length > 1 && (
              <div className="flex gap-2">
                {results.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedIdx(i)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      selectedIdx === i
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-amber-400'
                    }`}
                  >
                    Lösung {i + 1}
                    <span className="block font-normal opacity-75">
                      {fmtEur(r.totalSaving)} gespart
                    </span>
                  </button>
                ))}
              </div>
            )}

            {(() => {
              const result = results[selectedIdx];
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 px-0.5">
                    <span>{numPlates} {numPlates === 1 ? 'Blech' : 'Bleche'}</span>
                    <span>{result.generationsRan} Generationen</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <SummaryCard label="Reste vorher" value={fmtEur(result.totalLeftoverBefore)} sub="" />
                    <SummaryCard label="Reste nachher" value={fmtEur(result.totalLeftoverAfter)} sub="" highlight="green" />
                    <SummaryCard
                      label="Ersparnis"
                      value={fmtEur(result.totalSaving)}
                      sub={result.costChange !== 0 ? `Einkauf ${result.costChange > 0 ? '+' : ''}${fmtEur(result.costChange)}` : 'Einkauf unverändert'}
                      highlight={result.totalSaving > 0 ? 'green' : undefined}
                    />
                  </div>

                  {result.toppingPercentUsed !== config.toppingPercent && (
                    <p className="text-xs text-amber-600">
                      Streusel-Anteil angepasst: {config.toppingPercent}% → {Math.round(result.toppingPercentUsed)}%
                    </p>
                  )}

                  <div className="overflow-x-auto -mx-1">
                    <table className="w-full text-xs min-w-[600px]">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-1.5 pl-1 font-medium text-gray-400">Zutat</th>
                          <th className="text-right py-1.5 font-medium text-gray-400">Basis/Blech</th>
                          <th className="text-right py-1.5 font-medium text-gray-400">Optimiert/Blech</th>
                          <th className="text-right py-1.5 font-medium text-gray-400">Δ%</th>
                          <th className="text-right py-1.5 font-medium text-gray-400">€/Blech</th>
                          <th className="text-right py-1.5 font-medium text-gray-400">Rest vorher</th>
                          <th className="text-right py-1.5 font-medium text-gray-400">Rest nachher</th>
                          <th className="text-right py-1.5 pr-1 font-medium text-gray-400">Ersparnis</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.ingredients
                          .filter(r => r.baseAmountPerPlate > 0 || r.adjustedAmountPerPlate > 0)
                          .map(r => {
                            const deltaPct = (r.multiplier - 1) * 100;
                            const isChanged = Math.abs(deltaPct) >= 0.5;
                            return (
                              <tr key={r.id} className="border-b border-gray-50">
                                <td className={`py-1.5 pl-1 pr-1 leading-tight ${isChanged ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
                                  {r.label.replace(/ \([^)]+\)$/, '')}
                                </td>
                                <td className="text-right py-1.5 pr-1.5 text-gray-500">
                                  {fmtAmount(r.baseAmountPerPlate, r.unit)}
                                </td>
                                <td className={`text-right py-1.5 pr-1.5 font-medium ${isChanged ? 'text-amber-700' : 'text-gray-500'}`}>
                                  {fmtAmount(r.adjustedAmountPerPlate, r.unit)}
                                </td>
                                <td className={`text-right py-1.5 pr-1.5 font-medium ${
                                  Math.abs(deltaPct) >= 3 ? 'text-amber-600' : isChanged ? 'text-gray-600' : 'text-gray-300'
                                }`}>
                                  {deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%
                                </td>
                                <td className="text-right py-1.5 pr-1.5 font-medium text-gray-700">
                                  {fmtEur(r.costPerPlate)}
                                </td>
                                <td className="text-right py-1.5 pr-1.5 text-gray-400">{fmtEur(r.costBefore)}</td>
                                <td className={`text-right py-1.5 pr-1.5 ${r.costAfter < r.costBefore ? 'text-green-600' : 'text-gray-400'}`}>
                                  {fmtEur(r.costAfter)}
                                </td>
                                <td className={`text-right py-1.5 pr-1 font-semibold ${
                                  r.saving > 0.005 ? 'text-green-700' : r.saving < -0.005 ? 'text-red-500' : 'text-gray-300'
                                }`}>
                                  {r.saving > 0.005 ? '+' : ''}{fmtEur(r.saving)}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200">
                          <td colSpan={4} className="py-1.5 pl-1 text-xs font-semibold text-gray-600">
                            Gesamt
                          </td>
                          <td className="text-right py-1.5 pr-1.5 font-bold text-gray-800">
                            {fmtEur(result.ingredients.reduce((s, r) => s + r.costPerPlate, 0))}
                          </td>
                          <td className="text-right py-1.5 pr-1.5 font-semibold text-gray-600">{fmtEur(result.totalLeftoverBefore)}</td>
                          <td className="text-right py-1.5 pr-1.5 font-semibold text-green-700">{fmtEur(result.totalLeftoverAfter)}</td>
                          <td className="text-right py-1.5 pr-1 font-bold text-green-700">+{fmtEur(result.totalSaving)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => onApply(result.multipliers, result.toppingPercentUsed)}
                      className="flex-1 py-2 rounded-lg font-semibold text-sm bg-green-600 text-white hover:bg-green-700 transition-colors"
                    >
                      Übernehmen — optimierte Mengen anwenden
                    </button>
                    <button
                      onClick={() => handleShare(result)}
                      className="px-3 py-2 rounded-lg font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors relative"
                      title="Link teilen"
                    >
                      {shareToast ? 'Kopiert!' : 'Teilen'}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

function SliderField({
  label, value, min, max, step, display, minLabel, maxLabel, disabled, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  display: string; minLabel: string; maxLabel: string; disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-bold text-amber-600">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full accent-amber-600"
      />
      <div className="flex justify-between text-xs text-gray-300 mt-0.5">
        <span>{minLabel}</span><span>{maxLabel}</span>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, highlight }: {
  label: string; value: string; sub: string; highlight?: 'green';
}) {
  return (
    <div className="bg-gray-50 rounded-lg px-2 py-2">
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className={`font-bold text-sm ${highlight === 'green' ? 'text-green-700' : 'text-gray-900'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}
