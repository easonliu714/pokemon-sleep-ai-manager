import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_PUBLIC_MASTER = path.join(ROOT, 'assets/js/public-recipe-master.js');

const FORBIDDEN_OUTPUT_KEYS = Object.freeze([
  'recipe_level', 'current_energy', 'private_recipe_id', 'source_image_ref',
  'source_image_sha256', 'source_zip_sha256', 'notes', 'update_id',
  'operation_id', 'updated_at', 'generated_at',
]);

const CATEGORY_ALIASES = Object.freeze(new Map([
  ['咖哩／濃湯', '咖哩／濃湯'],
  ['沙拉', '沙拉'],
  ['點心／飲料', '甜點／飲料'],
  ['甜點／飲料', '甜點／飲料'],
]));

function normalizeText(value) {
  return String(value ?? '').normalize('NFKC').replaceAll('/', '／').replace(/[\s　]+/g, '').trim();
}

export function normalizeCategory(value) {
  const normalized = normalizeText(value);
  return CATEGORY_ALIASES.get(normalized) ?? normalized;
}

function normalizeIngredientRows(rows) {
  const combined = new Map();
  for (const row of rows ?? []) {
    const ingredientName = normalizeText(row?.ingredient_name ?? row?.name ?? row?.[0]);
    const quantity = Number(row?.quantity ?? row?.[1]);
    if (!ingredientName || !Number.isFinite(quantity) || quantity <= 0) continue;
    combined.set(ingredientName, (combined.get(ingredientName) ?? 0) + quantity);
  }
  return [...combined.entries()]
    .map(([ingredient_name, quantity]) => Object.freeze({ ingredient_name, quantity }))
    .sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name, 'zh-Hant'));
}

export function ingredientSignature(category, rows) {
  const ingredients = normalizeIngredientRows(rows);
  return `${normalizeCategory(category)}::${ingredients.map((row) => `${row.ingredient_name}=${row.quantity}`).join('|')}`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function extractExactFreezeArgument(source, declarationName) {
  const pattern = new RegExp(`export\\s+const\\s+${declarationName}\\s*=\\s*Object\\.freeze\\s*\\(`);
  const match = pattern.exec(source);
  if (!match) throw new Error(`exact_freeze_declaration_not_found:${declarationName}`);
  const start = match.index + match[0].lastIndexOf('(');

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
    if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(start + 1, index);
    }
  }
  throw new Error(`freeze_call_end_not_found:${declarationName}`);
}

export function loadPublicRecipeMaster(filePath = DEFAULT_PUBLIC_MASTER) {
  const source = fs.readFileSync(filePath, 'utf8');
  const versionMatch = source.match(/export\s+const\s+PUBLIC_RECIPE_MASTER_VERSION\s*=\s*['"]([^'"]+)['"]/);
  const publicVersion = versionMatch?.[1] ?? 'UNKNOWN_PUBLIC_RECIPE_MASTER_VERSION';
  const argument = extractExactFreezeArgument(source, 'PUBLIC_RECIPE_MASTER');
  const context = {
    PUBLIC_RECIPE_MASTER_VERSION: publicVersion,
    PUBLIC_RECIPE_SOURCE: Object.freeze({ data_version: publicVersion }),
  };
  const value = vm.runInNewContext(`(${argument})`, context, { timeout: 1500 });
  if (!Array.isArray(value)) throw new Error('public_recipe_master_not_array');
  return value.map((row) => Object.freeze({
    recipe_id: String(row?.recipe_id ?? ''),
    category: normalizeCategory(row?.category),
    recipe_name: normalizeText(row?.recipe_name),
    ingredients: normalizeIngredientRows(row?.ingredients),
  }));
}

function assertPrivateInputContract(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('private_payload_missing');
  if (!Array.isArray(payload.operations)) throw new Error('private_payload_operations_missing');
  if (payload.privacy?.github_commit_allowed !== false) throw new Error('private_payload_privacy_marker_required');
}

function buildObservedRecipes(payload) {
  const byPrivateId = new Map();
  const ensure = (privateId) => {
    if (!privateId) throw new Error('private_recipe_link_key_missing');
    if (!byPrivateId.has(privateId)) byPrivateId.set(privateId, { recipe: null, ingredients: [] });
    return byPrivateId.get(privateId);
  };

  for (const operation of payload.operations) {
    if (operation?.action !== 'upsert') continue;
    if (operation?.entity === 'recipes') {
      const bucket = ensure(String(operation?.key?.recipe_id ?? ''));
      if (bucket.recipe) throw new Error('duplicate_private_recipe_operation');
      bucket.recipe = {
        recipe_name: normalizeText(operation?.data?.recipe_name),
        category: normalizeCategory(operation?.data?.category),
      };
    } else if (operation?.entity === 'recipe_ingredients') {
      const bucket = ensure(String(operation?.key?.recipe_id ?? ''));
      bucket.ingredients.push({
        ingredient_name: normalizeText(operation?.key?.ingredient_name),
        quantity: Number(operation?.data?.quantity),
      });
    }
  }

  const observed = [];
  for (const bucket of byPrivateId.values()) {
    if (!bucket.recipe) throw new Error('ingredient_rows_without_recipe_operation');
    if (!bucket.recipe.recipe_name || !bucket.recipe.category) throw new Error('recipe_identity_incomplete');
    const ingredients = normalizeIngredientRows(bucket.ingredients);
    if (!ingredients.length) throw new Error(`recipe_ingredients_missing:${bucket.recipe.recipe_name}`);
    observed.push(Object.freeze({
      observed_name: bucket.recipe.recipe_name,
      category: bucket.recipe.category,
      ingredients,
    }));
  }
  return observed.sort((a, b) => a.category.localeCompare(b.category, 'zh-Hant') || a.observed_name.localeCompare(b.observed_name, 'zh-Hant'));
}

function bigrams(value) {
  const text = normalizeText(value);
  if (text.length < 2) return new Set(text ? [text] : []);
  const result = new Set();
  for (let i = 0; i < text.length - 1; i += 1) result.add(text.slice(i, i + 2));
  return result;
}

function diceCoefficient(left, right) {
  const a = bigrams(left);
  const b = bigrams(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return (2 * intersection) / (a.size + b.size);
}

function commonSuffixRatio(left, right) {
  const a = normalizeText(left);
  const b = normalizeText(right);
  const denominator = Math.max(1, Math.min(a.length, b.length));
  let count = 0;
  while (count < denominator && a[a.length - 1 - count] === b[b.length - 1 - count]) count += 1;
  return count / denominator;
}

function nameSimilarity(left, right) {
  return Math.max(diceCoefficient(left, right), commonSuffixRatio(left, right));
}

function findFormulaMatches(observed, publicRows) {
  const signature = ingredientSignature(observed.category, observed.ingredients);
  return publicRows.filter((row) => ingredientSignature(row.category, row.ingredients) === signature);
}

function chooseConflictCandidate(observed, publicRows) {
  const sameCategory = publicRows.filter((row) => row.category === observed.category);
  const exactName = sameCategory.find((row) => row.recipe_name === observed.observed_name);
  if (exactName) return { row: exactName, score: 1, basis: 'EXACT_NAME_DIFFERENT_FORMULA' };

  const ranked = sameCategory
    .map((row) => ({ row, score: nameSimilarity(observed.observed_name, row.recipe_name) }))
    .sort((a, b) => b.score - a.score || a.row.recipe_id.localeCompare(b.row.recipe_id));
  const best = ranked[0];
  const second = ranked[1];
  if (!best || best.score < 0.6) return null;
  if (second && best.score - second.score < 0.15) return null;
  const observedTotal = observed.ingredients.reduce((sum, row) => sum + row.quantity, 0);
  const publicTotal = best.row.ingredients.reduce((sum, row) => sum + row.quantity, 0);
  if (observedTotal !== publicTotal) return null;
  return { row: best.row, score: best.score, basis: 'CONSERVATIVE_NAME_SIMILARITY_SAME_TOTAL' };
}

function classifyObservedRecipe(observed, publicRows) {
  const formulaMatches = findFormulaMatches(observed, publicRows);
  if (formulaMatches.length === 1) {
    const match = formulaMatches[0];
    return {
      classification: match.recipe_name === observed.observed_name ? 'EXACT_NAME' : 'NAME_ALIAS',
      matched: match,
      match_basis: 'CATEGORY_INGREDIENT_SIGNATURE',
      name_similarity: Number(nameSimilarity(observed.observed_name, match.recipe_name).toFixed(4)),
    };
  }
  if (formulaMatches.length > 1) {
    const exactName = formulaMatches.filter((row) => row.recipe_name === observed.observed_name);
    if (exactName.length === 1) {
      return { classification: 'EXACT_NAME', matched: exactName[0], match_basis: 'CATEGORY_INGREDIENT_SIGNATURE_PLUS_EXACT_NAME', name_similarity: 1 };
    }
    return { classification: 'UNRESOLVED', matched: null, match_basis: 'AMBIGUOUS_FORMULA_SIGNATURE', name_similarity: null };
  }
  const conflict = chooseConflictCandidate(observed, publicRows);
  if (conflict) {
    return {
      classification: 'FORMULA_CONFLICT',
      matched: conflict.row,
      match_basis: conflict.basis,
      name_similarity: Number(conflict.score.toFixed(4)),
    };
  }
  return { classification: 'UNRESOLVED', matched: null, match_basis: 'NO_UNIQUE_PUBLIC_IDENTITY', name_similarity: null };
}

function classificationCounts(records) {
  const counts = { EXACT_NAME: 0, NAME_ALIAS: 0, FORMULA_CONFLICT: 0, UNRESOLVED: 0 };
  for (const row of records) counts[row.classification] += 1;
  return counts;
}

function categoryCounts(records) {
  const counts = {};
  for (const row of records) counts[row.category] = (counts[row.category] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b, 'zh-Hant')));
}

function collectForbiddenRawValues(payload) {
  const values = new Set();
  if (payload?.update_id) values.add(String(payload.update_id));
  for (const operation of payload?.operations ?? []) {
    if (operation?.key?.recipe_id) values.add(String(operation.key.recipe_id));
    if (operation?.operation_id) values.add(String(operation.operation_id));
    if (operation?.data?.notes) values.add(String(operation.data.notes));
    if (operation?.evidence?.source_image_ref) values.add(String(operation.evidence.source_image_ref));
    if (operation?.evidence?.source_image_sha256) values.add(String(operation.evidence.source_image_sha256));
    if (operation?.evidence?.source_zip_sha256) values.add(String(operation.evidence.source_zip_sha256));
  }
  return [...values].filter((value) => value.length >= 4);
}

export function assertSanitizedReport(report, rawPayload) {
  const serialized = JSON.stringify(report);
  for (const key of FORBIDDEN_OUTPUT_KEYS) {
    if (serialized.includes(`\"${key}\"`)) throw new Error(`privacy_forbidden_output_key:${key}`);
  }
  for (const value of collectForbiddenRawValues(rawPayload)) {
    if (serialized.includes(value)) throw new Error('privacy_forbidden_raw_value');
  }
  return true;
}

export function auditPrivateRecipePayload(payload, publicRows) {
  assertPrivateInputContract(payload);
  const observed = buildObservedRecipes(payload);
  const records = observed.map((recipe) => {
    const result = classifyObservedRecipe(recipe, publicRows);
    return Object.freeze({
      observed_name: recipe.observed_name,
      category: recipe.category,
      ingredients: recipe.ingredients,
      matched_public_recipe_id: result.matched?.recipe_id ?? null,
      matched_public_name: result.matched?.recipe_name ?? null,
      classification: result.classification,
      match_basis: result.match_basis,
      name_similarity: result.name_similarity,
      evidence_class: 'GAME_SCREENSHOT_DERIVED_ZH_TW',
    });
  });
  const report = Object.freeze({
    schema: 'pokemon-sleep-recipe-zh-tw-evidence-audit/1.0',
    read_only: true,
    database_opened: false,
    database_write_performed: false,
    source_privacy: 'PRIVATE_INPUT_SANITIZED_OUTPUT',
    observed_recipe_count: records.length,
    category_counts: categoryCounts(records),
    classification_counts: classificationCounts(records),
    records,
  });
  assertSanitizedReport(report, payload);
  return report;
}

function argumentValue(prefix) {
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : null;
}

export function runAuditFromFiles({ privateFile, publicMasterFile = DEFAULT_PUBLIC_MASTER, requireCount = null }) {
  if (!privateFile) throw new Error('private_file_argument_required');
  const payload = readJson(path.resolve(process.cwd(), privateFile));
  const publicRows = loadPublicRecipeMaster(path.resolve(process.cwd(), publicMasterFile));
  const report = auditPrivateRecipePayload(payload, publicRows);
  if (requireCount != null && report.observed_recipe_count !== Number(requireCount)) {
    throw new Error(`observed_recipe_count_mismatch:${report.observed_recipe_count}:${requireCount}`);
  }
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  const privateFile = argumentValue('--private-file=');
  const publicMasterFile = argumentValue('--public-master=') ?? DEFAULT_PUBLIC_MASTER;
  const requireCount = argumentValue('--require-count=');
  try {
    const report = runAuditFromFiles({ privateFile, publicMasterFile, requireCount });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 2;
  }
}
