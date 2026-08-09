import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const HISTORICAL_REGISTRY = path.join(root, 'assets/js/v0383-catalog-ocr-review-contract.js');
const SHARED_MASTER = path.join(root, 'assets/js/shared-master-data.js');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function extractArrayLiteral(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`marker_not_found:${marker}`);
  const equalsIndex = source.indexOf('=', markerIndex + marker.length);
  const start = source.indexOf('[', equalsIndex + 1);
  if (equalsIndex < 0 || start < 0) throw new Error(`array_start_not_found:${marker}`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '[') depth += 1;
    else if (char === ']') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`array_end_not_found:${marker}`);
}

function evaluateLiteral(literal, label) {
  const value = vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 1000 });
  if (!Array.isArray(value)) throw new Error(`not_array:${label}`);
  return value;
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replaceAll('/', '／')
    .replace(/\s+/g, '')
    .trim();
}

function parseSummary(summary) {
  return String(summary ?? '')
    .split('、')
    .map((part) => {
      const match = part.match(/^(.*)×(\d+)$/);
      return match ? [normalizeText(match[1]), Number(match[2])] : null;
    })
    .filter(Boolean)
    .sort((a, b) => a[0].localeCompare(b[0], 'zh-Hant'));
}

function normalizeIngredientRows(rows) {
  return (rows ?? [])
    .map(([name, quantity]) => [normalizeText(name), Number(quantity)])
    .sort((a, b) => a[0].localeCompare(b[0], 'zh-Hant'));
}

function stableIngredients(rows) {
  return JSON.stringify(rows);
}

const historicalSource = read(HISTORICAL_REGISTRY);
const sharedSource = read(SHARED_MASTER);

const historicalRows = evaluateLiteral(
  extractArrayLiteral(historicalSource, 'const RECIPES'),
  'historical_registry',
);
const sharedRows = evaluateLiteral(
  extractArrayLiteral(sharedSource, 'const RECIPES'),
  'shared_master',
);

const historical = historicalRows.map(([category, name, summary]) => ({
  category: normalizeText(category),
  name: normalizeText(name),
  ingredients: parseSummary(summary),
}));
const shared = sharedRows.map(([category, id, name, baseEnergy, totalIngredients, ingredients]) => ({
  id: String(id),
  category: normalizeText(category),
  name: normalizeText(name),
  base_energy: baseEnergy == null ? null : Number(baseEnergy),
  total_ingredients: Number(totalIngredients ?? 0),
  ingredients: normalizeIngredientRows(ingredients),
}));

const historicalByName = new Map(historical.map((row) => [row.name, row]));
const sharedByName = new Map(shared.map((row) => [row.name, row]));
const historicalNames = new Set(historicalByName.keys());
const sharedNames = new Set(sharedByName.keys());

const onlyInHistorical = [...historicalNames].filter((name) => !sharedNames.has(name)).sort();
const onlyInShared = [...sharedNames].filter((name) => !historicalNames.has(name)).sort();
const commonNames = [...historicalNames].filter((name) => sharedNames.has(name)).sort();

const ingredientMismatches = commonNames.flatMap((name) => {
  const left = historicalByName.get(name);
  const right = sharedByName.get(name);
  if (stableIngredients(left.ingredients) === stableIngredients(right.ingredients)) return [];
  return [{
    recipe_name: name,
    historical: left.ingredients,
    shared_master: right.ingredients,
  }];
});

function categoryCounts(rows) {
  return rows.reduce((result, row) => {
    result[row.category] = (result[row.category] ?? 0) + 1;
    return result;
  }, {});
}

const report = {
  schema: 'pokemon-sleep-recipe-authority-audit/1.0',
  generated_at: new Date().toISOString(),
  read_only: true,
  database_opened: false,
  database_write_performed: false,
  sources: {
    historical_registry: path.relative(root, HISTORICAL_REGISTRY),
    shared_master: path.relative(root, SHARED_MASTER),
  },
  counts: {
    historical_registry: historical.length,
    shared_master: shared.length,
    common_names: commonNames.length,
    only_in_historical: onlyInHistorical.length,
    only_in_shared: onlyInShared.length,
    ingredient_mismatch: ingredientMismatches.length,
  },
  categories: {
    historical_registry: categoryCounts(historical),
    shared_master: categoryCounts(shared),
  },
  only_in_historical: onlyInHistorical,
  only_in_shared: onlyInShared,
  ingredient_mismatches: ingredientMismatches,
  parity: onlyInHistorical.length === 0
    && onlyInShared.length === 0
    && ingredientMismatches.length === 0,
};

const seedArgument = process.argv.find((value) => value.startsWith('--seed-output='));
if (seedArgument) {
  const outputValue = seedArgument.slice('--seed-output='.length);
  if (!outputValue) throw new Error('seed_output_path_missing');
  const outputPath = path.resolve(process.cwd(), outputValue);
  const seed = {
    schema: 'pokemon-sleep-recipe-authority-migration-seed/1.0',
    generated_at: report.generated_at,
    read_only: true,
    database_opened: false,
    database_write_performed: false,
    historical_recipe_count: historical.length,
    shared_recipe_count: shared.length,
    historical_recipes: historical,
    shared_recipes: shared,
    exact_common_names: commonNames,
    shared_only_name_candidates: onlyInShared,
    historical_only_name_candidates: onlyInHistorical,
    ingredient_conflicts: ingredientMismatches,
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (process.argv.includes('--strict') && !report.parity) {
  process.exitCode = 2;
}
