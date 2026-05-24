# Rezept-Rechner

A browser-based cost calculator for batch baking. Define any recipe in a YAML file and the app calculates shopping costs, how many plates fit within a budget, per-slice nutrition and price, batch mixing instructions, and runs a genetic algorithm to minimise packaging waste.

**Live:** https://qerim.github.io/cake-calculator/

## Recipes

| Recipe | Source |
|--------|--------|
| Schoko-Kirschkuchen | [chefkoch.de](https://www.chefkoch.de/rezepte/3912411596808801/Saftiger-veganer-Schoko-Kirschkuchen-vom-Blech.html) |

## Adding a new recipe

1. Copy `recipes/schoko-kirschkuchen.yaml` to `recipes/<your-recipe-id>.yaml`
2. Edit the YAML — change `id`, `name`, ingredients, prices, plate sizes
3. No code changes needed. The recipe appears automatically in the selector.
4. Open a PR or push to `main` — GitHub Actions rebuilds and redeploys.

## Development

```bash
npm install
npm run dev
```

The app is a standard Vite + React + TypeScript project. Recipes are loaded at build time via `import.meta.glob('../recipes/*.yaml')` using [@modyfi/vite-plugin-yaml](https://github.com/Modyfi/vite-plugin-yaml).

## YAML Schema

All fields unless noted are **required**.

```yaml
id: my-recipe            # unique string; used as localStorage key
name: My Recipe          # displayed in the header and selector
source: "https://..."    # optional; makes the recipe name a link
description: "..."       # optional; subtitle under the name

plates:                  # at least one plate definition
  - id: standard
    label: "Standard"
    widthCm: 39
    lengthCm: 32
    default: true        # optional; first plate used if absent
  - id: large
    label: "Large"
    widthCm: 53
    lengthCm: 32
    adjustable: true     # optional; shows dimension inputs in UI

batter:
  baseMl: 1101           # batter volume per reference plate in ml (dry + liquids, no batch extras)
  extraLiquidPerBatchMl: 500   # optional; liquid added once per batch (e.g. cherry juice)
  extraLiquidLabel: "Cherry juice"  # optional; label in batch recipe display

ingredients:
  - id: flour
    label: Flour
    unit: g              # "g" or "ml"
    baseAmount: 450      # amount per reference plate
    kcalPerUnit: 3.4     # kcal per g or ml
    # role: omitted → normal ingredient
    prices:
      retail:
        packSize: 1000   # grams or ml per pack
        packPrice: 0.79  # € per pack
      gastro:
        packSize: 10000
        packPrice: 6.00
        bulkDiscount:    # optional
          minPacks: 12   # discount applies when buying more than this many packs
          packPrice: 5.50

  # role: weight_pct — amount derived from a configurable % of batter weight
  # renders a slider; use for fruit/toppings added by weight ratio
  - id: cherries
    label: Cherries
    unit: g
    baseAmount: 700      # used to derive the default slider position
    kcalPerUnit: 0.5
    role: weight_pct
    sliderMin: 0         # optional, default 0
    sliderMax: 50        # optional, default 50
    prices:
      retail: { packSize: 700, packPrice: 1.99 }
      gastro: { packSize: 700, packPrice: 1.99 }

  # role: optional_toggle — shown as an on/off toggle, off by default
  - id: lecithin
    label: Lecithin
    unit: g
    baseAmount: 9
    kcalPerUnit: 8.0
    role: optional_toggle
    toggleLabel: "Reduces oiliness"   # optional hint shown under the toggle
    prices:
      retail: { packSize: 1, packPrice: 0.02 }
      gastro: { packSize: 1, packPrice: 0.02 }

topping:                 # optional section; omit entirely for recipes without toppings
  label: Streusel
  sliderLabel: "Plates with topping"  # optional
  defaultPercent: 100    # optional, default 100
  ingredients:
    - id: coconut
      label: Coconut flakes
      unit: g
      baseAmount: 200
      kcalPerUnit: 6.0
      prices:
        retail: { packSize: 200, packPrice: 0.99 }
        gastro: { packSize: 1000, packPrice: 6.00 }
```

### Notes on `batter.baseMl`

This is used to calculate bowl capacity (how many plates fit per mixing batch). It should include all liquid and dry ingredients that go into the bowl per plate, **excluding** any liquid added once per batch (like drained fruit juice). Dry ingredients count as approximately 1 ml/g.

For the Schoko-Kirschkuchen recipe: 916 g dry ingredients + 185 ml oil = 1101 ml.

## License

MIT
