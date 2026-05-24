import type { SliceConfig, PlateConfig } from '../types';

interface Props {
  config: SliceConfig;
  onChange: (c: SliceConfig) => void;
  plateConfig: PlateConfig;
  slicesPerPlate: number;
}

export function SliceConfigPanel({ config, onChange, plateConfig, slicesPerPlate }: Props) {
  const set = (partial: Partial<SliceConfig>) => onChange({ ...config, ...partial });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
      <h2 className="text-base font-semibold text-gray-900">Scheiben-Konfiguration</h2>

      {/* Method toggle */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
        {(['dimensions', 'weight'] as const).map((m) => (
          <button
            key={m}
            onClick={() => set({ method: m })}
            className={`flex-1 py-2 font-medium transition-colors ${
              config.method === m
                ? 'bg-amber-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {m === 'dimensions' ? 'Nach Maßen' : 'Nach Gewicht'}
          </button>
        ))}
      </div>

      {config.method === 'dimensions' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Scheibenbreite (cm)</label>
              <input
                type="number"
                min="1" step="0.5"
                value={config.sliceWidthCm}
                onChange={(e) => set({ sliceWidthCm: Math.max(0.5, parseFloat(e.target.value) || 1) })}
                className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Scheibenlänge (cm)</label>
              <input
                type="number"
                min="1" step="0.5"
                value={config.sliceLengthCm}
                onChange={(e) => set({ sliceLengthCm: Math.max(0.5, parseFloat(e.target.value) || 1) })}
                className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
              />
            </div>
          </div>
          <div className="text-xs text-gray-500 bg-gray-50 rounded-md p-2">
            Blech: {plateConfig.widthCm} × {plateConfig.lengthCm} cm = {plateConfig.widthCm * plateConfig.lengthCm} cm²
            {' | '}Scheibe: {config.sliceWidthCm} × {config.sliceLengthCm} cm = {(config.sliceWidthCm * config.sliceLengthCm).toFixed(1)} cm²
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Gewicht pro Scheibe (g)</label>
          <input
            type="number"
            min="10" step="10"
            value={config.weightG}
            onChange={(e) => set({ weightG: Math.max(10, parseInt(e.target.value) || 50) })}
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
          />
        </div>
      )}

      <div className="bg-amber-50 rounded-lg p-3 text-center">
        <span className="text-2xl font-bold text-amber-700">{slicesPerPlate}</span>
        <span className="text-sm text-amber-600 ml-1">Scheiben pro Blech</span>
      </div>
    </div>
  );
}
