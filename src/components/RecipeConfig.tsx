import type { RecipeDefinition, RecipeConfig, PlateConfig } from '../types';
import { getBatterWeightG, getPlateConfig } from '../recipeUtils';
import { getBatterLitersPerPlate, getScalingFactor } from '../calculator';

interface Props {
  recipe: RecipeDefinition;
  config: RecipeConfig;
  onChange: (c: RecipeConfig) => void;
  plateConfig: PlateConfig;
  onPlateConfigChange: (p: PlateConfig) => void;
}

export function RecipeConfigPanel({ recipe, config, onChange, plateConfig, onPlateConfigChange }: Props) {
  const set = (partial: Partial<RecipeConfig>) => onChange({ ...config, ...partial });

  const handlePlateSelect = (plateId: string) => {
    set({ plateId });
    onPlateConfigChange(getPlateConfig(recipe, plateId));
  };

  const wpIng = recipe.ingredients.find(i => i.role === 'weight_pct');
  const toggleIngs = recipe.ingredients.filter(i => i.role === 'optional_toggle');

  const plateArea = plateConfig.widthCm * plateConfig.lengthCm;
  const scale = getScalingFactor(recipe, config, plateConfig);
  const batterWeightG = getBatterWeightG(recipe);
  const wpPct = Math.min(config.weightPctValue, 99.9);
  const wpGrams = wpPct > 0 && wpIng ? Math.round((batterWeightG * scale * wpPct) / (100 - wpPct)) : 0;
  const batterLiters = getBatterLitersPerPlate(recipe, config, plateConfig);

  // Default weightPctValue as reference (derived from baseAmount in YAML)
  const defaultPlate = recipe.plates.find(p => p.default) ?? recipe.plates[0];
  const defaultWpPct = wpIng && batterWeightG > 0
    ? Math.round((wpIng.baseAmount / (batterWeightG + wpIng.baseAmount)) * 1000) / 10
    : null;

  const currentPlate = recipe.plates.find(p => p.id === config.plateId) ?? defaultPlate;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
      <h2 className="text-base font-semibold text-gray-900">Rezept-Konfiguration</h2>

      {/* Plate selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Blechgröße</label>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {recipe.plates.map((plate) => (
            <button
              key={plate.id}
              onClick={() => handlePlateSelect(plate.id)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                config.plateId === plate.id
                  ? 'bg-amber-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {plate.label}
            </button>
          ))}
        </div>

        {currentPlate.adjustable ? (
          <div className="flex items-end gap-2 mt-2">
            <DimInput label="Breite (cm)" value={plateConfig.widthCm} onChange={(v) => onPlateConfigChange({ ...plateConfig, widthCm: v })} />
            <span className="text-gray-400 pb-1.5">×</span>
            <DimInput label="Länge (cm)" value={plateConfig.lengthCm} onChange={(v) => onPlateConfigChange({ ...plateConfig, lengthCm: v })} />
            <span className="text-xs text-gray-400 pb-1.5 whitespace-nowrap">
              = {plateArea} cm² · Faktor ×{scale.toFixed(2)}
            </span>
          </div>
        ) : (
          <p className="text-xs text-gray-400 mt-1.5">
            {plateConfig.widthCm} × {plateConfig.lengthCm} cm = {plateArea} cm²
          </p>
        )}
      </div>

      {/* Weight-% ingredient slider */}
      {wpIng && (
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <label className="text-sm font-medium text-gray-700">{wpIng.label}anteil (Gewicht)</label>
            <span className="text-sm font-bold text-amber-700">
              {config.weightPctValue.toFixed(1)}%
              <span className="text-xs font-normal text-gray-400 ml-1">({wpGrams} g/Blech)</span>
            </span>
          </div>
          <input
            type="range"
            min={wpIng.sliderMin ?? 0}
            max={wpIng.sliderMax ?? 50}
            step="0.5"
            value={config.weightPctValue}
            onChange={(e) => set({ weightPctValue: parseFloat(e.target.value) })}
            className="w-full accent-amber-600"
          />
          <div className="flex justify-between text-xs text-gray-300 mt-0.5">
            <span>{wpIng.sliderMin ?? 0}%</span>
            {defaultWpPct != null && (
              <span className="text-amber-400">↑ Rezept ({defaultWpPct.toFixed(1)}%)</span>
            )}
            <span>{wpIng.sliderMax ?? 50}%</span>
          </div>
        </div>
      )}

      {/* Topping slider */}
      {recipe.topping && (
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <label className="text-sm font-medium text-gray-700">
              {recipe.topping.sliderLabel ?? `Bleche mit ${recipe.topping.label}`}
            </label>
            <span className="text-sm font-bold text-amber-700">{config.toppingPercent}%</span>
          </div>
          <input
            type="range" min="0" max="100" step="10"
            value={config.toppingPercent}
            onChange={(e) => set({ toppingPercent: parseInt(e.target.value) })}
            className="w-full accent-amber-600"
          />
          <div className="flex justify-between text-xs text-gray-300 mt-0.5">
            <span>Kein {recipe.topping.label}</span><span>50%</span><span>Alle</span>
          </div>
        </div>
      )}

      {/* Optional toggles */}
      {toggleIngs.map(ing => (
        <div key={ing.id} className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">{ing.label}</label>
            {ing.toggleLabel && <p className="text-xs text-gray-400">{ing.toggleLabel}</p>}
          </div>
          <button
            onClick={() => {
              const enabled = config.enabledToggles.includes(ing.id);
              set({ enabledToggles: enabled
                ? config.enabledToggles.filter(id => id !== ing.id)
                : [...config.enabledToggles, ing.id]
              });
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              config.enabledToggles.includes(ing.id) ? 'bg-amber-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                config.enabledToggles.includes(ing.id) ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      ))}

      {/* Bowl size */}
      <div>
        <div className="flex justify-between items-baseline mb-1">
          <label className="text-sm font-medium text-gray-700">Rührschüssel</label>
          <span className="text-xs text-gray-400">{batterLiters.toFixed(2)} L/Blech</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number" min="1" max="100" step="1"
            value={config.bowlLiters}
            onChange={(e) => set({ bowlLiters: Math.max(1, parseFloat(e.target.value) || 1) })}
            className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
          <span className="text-sm text-gray-500">L</span>
        </div>
      </div>
    </div>
  );
}

function DimInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type="number" min="10" max="100"
        value={value}
        onChange={(e) => onChange(Math.max(1, parseInt(e.target.value) || 1))}
        className="w-20 border border-gray-200 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-amber-400"
      />
    </div>
  );
}
