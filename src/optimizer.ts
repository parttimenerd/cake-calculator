import type { RecipeDefinition, RecipeConfig, PlateConfig, PriceTable, PriceTier, IngredientId, ShoppingList } from './types';
import { getAllIngredients } from './recipeUtils';
import { buildShoppingList } from './calculator';

export interface GAParams {
  recipe: RecipeDefinition;
  numPlates: number;
  config: RecipeConfig;
  plateConfig: PlateConfig;
  prices: PriceTable;
  tier: PriceTier;
  tolerance: number;
  populationSize: number;
  generations: number;
  penaltyFactor: number;
  earlyStopGenerations: number;
}

export interface IngredientResult {
  id: IngredientId;
  label: string;
  multiplier: number;
  baseAmountPerPlate: number;
  adjustedAmountPerPlate: number;
  unit: 'g' | 'ml';
  leftoverBefore: number;
  leftoverAfter: number;
  costBefore: number;
  costAfter: number;
  saving: number;
}

export interface GAResult {
  ingredients: IngredientResult[];
  totalLeftoverBefore: number;
  totalLeftoverAfter: number;
  totalSaving: number;
  totalCostBefore: number;
  totalCostAfter: number;
  costChange: number;
  generationsRan: number;
  multipliers: Partial<Record<IngredientId, number>>;
}

// ─── internal helpers ────────────────────────────────────────────────────────

type Genome = Float64Array;

function randUniform(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function gaussianNoise(): number {
  const u1 = Math.random() + 1e-12;
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function createGenome(recipe: RecipeDefinition, tol: number): Genome {
  const len = getAllIngredients(recipe).length;
  const g = new Float64Array(len);
  for (let i = 0; i < g.length; i++) g[i] = randUniform(1 - tol, 1 + tol);
  return g;
}

function genomeToMultipliers(recipe: RecipeDefinition, genome: Genome): Partial<Record<IngredientId, number>> {
  const m: Partial<Record<IngredientId, number>> = {};
  getAllIngredients(recipe).forEach((ing, i) => { m[ing.id] = genome[i]; });
  return m;
}

function buildAdjustedList(recipe: RecipeDefinition, genome: Genome, params: GAParams): ShoppingList {
  const cfg: RecipeConfig = { ...params.config, ingredientMultipliers: genomeToMultipliers(recipe, genome) };
  return buildShoppingList(recipe, params.numPlates, cfg, params.plateConfig, params.prices, params.tier);
}

function computeLeftoverCost(list: ShoppingList): number {
  return list.lines.reduce((sum, l) => sum + (l.leftover / l.packSize) * l.packPrice, 0);
}

function evaluate(recipe: RecipeDefinition, genome: Genome, params: GAParams, baselineTotal: number): number {
  const list = buildAdjustedList(recipe, genome, params);
  const leftoverCost = computeLeftoverCost(list);
  const costPenalty = Math.max(0, list.grandTotal - baselineTotal) * params.penaltyFactor;
  return leftoverCost + costPenalty;
}

function tournamentSelect(fitnesses: Float64Array, k: number): number {
  let best = Math.floor(Math.random() * fitnesses.length);
  for (let i = 1; i < k; i++) {
    const c = Math.floor(Math.random() * fitnesses.length);
    if (fitnesses[c] < fitnesses[best]) best = c;
  }
  return best;
}

function crossover(p1: Genome, p2: Genome, rate: number): Genome {
  if (Math.random() > rate) return p1.slice();
  const child = new Float64Array(p1.length);
  for (let i = 0; i < p1.length; i++) child[i] = Math.random() < 0.5 ? p1[i] : p2[i];
  return child;
}

function mutate(genome: Genome, rate: number, tol: number): Genome {
  const sigma = tol / 3;
  const g = genome.slice();
  const lo = 1 - tol, hi = 1 + tol;
  for (let i = 0; i < g.length; i++) {
    if (Math.random() < rate) g[i] = clamp(g[i] + gaussianNoise() * sigma, lo, hi);
  }
  return g;
}

function buildResult(recipe: RecipeDefinition, bestGenome: Genome, generationsRan: number, params: GAParams, baselineList: ShoppingList): GAResult {
  const adjustedList = buildAdjustedList(recipe, bestGenome, params);
  const multipliers = genomeToMultipliers(recipe, bestGenome);
  const { numPlates } = params;

  const ingredients: IngredientResult[] = [];
  for (let i = 0; i < getAllIngredients(recipe).length; i++) {
    const ing = getAllIngredients(recipe)[i];
    const baseLine = baselineList.lines.find(l => l.id === ing.id);
    const adjLine  = adjustedList.lines.find(l => l.id === ing.id);
    if (!baseLine && !adjLine) continue;

    const costBefore = baseLine ? (baseLine.leftover / baseLine.packSize) * baseLine.packPrice : 0;
    const costAfter  = adjLine  ? (adjLine.leftover  / adjLine.packSize)  * adjLine.packPrice  : 0;

    ingredients.push({
      id: ing.id,
      label: ing.label,
      multiplier: bestGenome[i],
      baseAmountPerPlate:     baseLine ? baseLine.totalNeeded / numPlates : 0,
      adjustedAmountPerPlate: adjLine  ? adjLine.totalNeeded  / numPlates : 0,
      unit: ing.unit,
      leftoverBefore: baseLine?.leftover ?? 0,
      leftoverAfter:  adjLine?.leftover  ?? 0,
      costBefore,
      costAfter,
      saving: costBefore - costAfter,
    });
  }

  const totalLeftoverBefore = ingredients.reduce((s, r) => s + r.costBefore, 0);
  const totalLeftoverAfter  = ingredients.reduce((s, r) => s + r.costAfter,  0);

  return {
    ingredients,
    totalLeftoverBefore,
    totalLeftoverAfter,
    totalSaving: totalLeftoverBefore - totalLeftoverAfter,
    totalCostBefore: baselineList.grandTotal,
    totalCostAfter: adjustedList.grandTotal,
    costChange: adjustedList.grandTotal - baselineList.grandTotal,
    generationsRan,
    multipliers,
  };
}

// ─── public API ──────────────────────────────────────────────────────────────

export function runGAAsync(
  params: GAParams,
  onProgress: (generation: number, bestFitness: number) => void,
): Promise<GAResult> {
  return new Promise(resolve => {
    const { recipe } = params;
    const { tolerance: tol, populationSize: popSize, generations: maxGen, earlyStopGenerations } = params;

    const baselineConfig: RecipeConfig = { ...params.config, ingredientMultipliers: {} };
    const baselineList = buildShoppingList(recipe, params.numPlates, baselineConfig, params.plateConfig, params.prices, params.tier);
    const baselineTotal = baselineList.grandTotal;

    let pop: Genome[] = Array.from({ length: popSize }, () => createGenome(recipe, tol));
    let fits = new Float64Array(popSize);
    for (let i = 0; i < popSize; i++) fits[i] = evaluate(recipe, pop[i], params, baselineTotal);

    let bestIdx = 0;
    for (let i = 1; i < popSize; i++) if (fits[i] < fits[bestIdx]) bestIdx = i;
    let bestGenome = pop[bestIdx].slice();
    let bestFitness = fits[bestIdx];
    let stagnant = 0;
    let gen = 0;

    const CHUNK = 10;
    const TOURNAMENT_K = 3;
    const CROSSOVER_RATE = 0.7;
    const MUTATION_RATE = 0.15;
    const ELITE = 2;

    function runChunk() {
      const end = Math.min(gen + CHUNK, maxGen);

      for (; gen < end; gen++) {
        const order = Array.from({ length: popSize }, (_, i) => i).sort((a, b) => fits[a] - fits[b]);
        const newPop: Genome[] = [];
        for (let e = 0; e < ELITE; e++) newPop.push(pop[order[e]].slice());

        while (newPop.length < popSize) {
          const p1 = tournamentSelect(fits, TOURNAMENT_K);
          const p2 = tournamentSelect(fits, TOURNAMENT_K);
          newPop.push(mutate(crossover(pop[p1], pop[p2], CROSSOVER_RATE), MUTATION_RATE, tol));
        }

        pop = newPop;
        for (let i = 0; i < popSize; i++) fits[i] = evaluate(recipe, pop[i], params, baselineTotal);

        let genBest = 0;
        for (let i = 1; i < popSize; i++) if (fits[i] < fits[genBest]) genBest = i;

        if (fits[genBest] < bestFitness - 1e-9) {
          bestFitness = fits[genBest];
          bestGenome = pop[genBest].slice();
          stagnant = 0;
        } else {
          stagnant++;
        }

        if (stagnant >= earlyStopGenerations) {
          gen++;
          onProgress(gen, bestFitness);
          resolve(buildResult(recipe, bestGenome, gen, params, baselineList));
          return;
        }
      }

      onProgress(gen, bestFitness);
      if (gen < maxGen) {
        setTimeout(runChunk, 0);
      } else {
        resolve(buildResult(recipe, bestGenome, gen, params, baselineList));
      }
    }

    setTimeout(runChunk, 0);
  });
}
