import type { RecipeDefinition } from './types';

const modules = import.meta.glob<{ default: RecipeDefinition }>('../recipes/*.yaml', { eager: true });
export const ALL_RECIPES: RecipeDefinition[] = Object.values(modules).map(m => m.default);
