/**
 * KRO-118 — Drift de PARIDAD DE API TS↔Dart (3ª capa del drift CI).
 *
 * Punto ciego de KRO-64 (version-drift + corpus): una feature ADDITIVE solo-TS
 * (export nuevo / campo opcional, SIN bump de versión) no la caza nadie —
 * version-drift ve el mismo número y el corpus solo cubre lo YA espejado. Esta
 * capa lo cierra: comprueba que cada símbolo CONTRACT-CRÍTICO del SDK TS tiene
 * contraparte (por nombre) en `core_dart`. Lo que falte → aviso con contexto
 * completo para que core_dart pueda actuar SIN relay manual.
 *
 * Modo:
 *   - default (WARN): imprime ::warning:: por cada hueco y sale 0 (no rompe main
 *     mientras Flutter se pone al día).
 *   - `KRP_PARITY_STRICT=1` (FAIL): sale 1 si hay huecos (gate duro cuando se decida).
 *
 * `must-mirror` es CURADO a propósito (no "todos los exports"): core_dart es un
 * subconjunto intencional (hay helpers solo-Studio). Añadir un símbolo aquí ES
 * el acto deliberado de decir "Flutter necesita esto".
 *
 * Convención de versión (IMPORTANTE para core_dart):
 *   pubspec.yaml#version SIEMPRE iguala packages/core/package.json#version.
 *   El TS canónico lidera; core_dart sigue. NO bumpees pubspec de forma
 *   independiente — espera a que el TS bumpe primero.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT          = join(__dirname, '..', '..');
const CORE_TS_SRC   = join(ROOT, 'core',      'src');
const CORE_PKG_JSON = join(ROOT, 'core',      'package.json');
const CORE_DART_LIB = join(ROOT, 'core_dart', 'lib');
const DART_PUBSPEC  = join(ROOT, 'core_dart', 'pubspec.yaml');

/**
 * Contexto por símbolo: fuente TS + corpus de tests + nota opcional.
 * Permite que core_dart (Flutter) actúe sin relay manual al ver el warning.
 *
 * Formato: { src: 'ruta desde packages/core/', tests: 'ruta tests/', note?: '...' }
 */
const SYMBOL_META = {
  // ── Clasificación + compatibilidad ──────────────────────────────────────
  classifyField:               { src: 'src/classify.ts',     tests: 'tests/classify.test.ts' },
  isFieldCompatibleWithSlot:   { src: 'src/classify.ts',     tests: 'tests/classify.test.ts' },
  isCompatible:                { src: 'src/version-compat.ts', tests: 'tests/version-compat.test.ts' },
  compareSemver:               { src: 'src/version-compat.ts', tests: 'tests/version-compat.test.ts' },

  // ── Validación ──────────────────────────────────────────────────────────
  validateComposition:         { src: 'src/validate.ts',     tests: 'tests/validate.test.ts',
    note: 'Incluye helpers internos validateSlot/validateTargetChain. Tipos: ValidationIssue, ValidationResult, ValidateCompositionOptions. ACCENT_IDS = {top,right,bottom,left,none,auto}.' },

  // ── Presentación ────────────────────────────────────────────────────────
  formatScalar:                { src: 'src/format-scalar.ts',  tests: 'tests/format-scalar.test.ts' },
  buildAutoDetailComposition:  { src: 'src/auto-detail.ts',    tests: 'tests/auto-detail.test.ts' },
  buildAutoListComposition:    { src: 'src/auto-detail.ts',    tests: 'tests/auto-detail.test.ts' },
  composeSlotValues:           { src: 'src/compose-slot.ts',   tests: 'tests/compose-slot.test.ts' },
  extractAccentSettings:       { src: 'src/extract-accent.ts', tests: 'tests/extract-accent.test.ts' },
  synthSectionItems:           { src: 'src/synth.ts',          tests: 'tests/synth.test.ts' },

  // ── Versionado de schema ────────────────────────────────────────────────
  isSchemaOutdated:            { src: 'src/schema-version.ts', tests: 'tests/schema-version.test.ts' },

  // ── Cadena multi-salto (KRO-94) ─────────────────────────────────────────
  resolveTargetChain:          { src: 'src/target-chain.ts',  tests: 'tests/target-chain.test.ts' },
  targetChainDepth:            { src: 'src/target-chain.ts',  tests: 'tests/target-chain.test.ts' },
  MAX_TARGET_DEPTH:            { src: 'src/target-chain.ts',  tests: 'tests/target-chain.test.ts',
    note: 'Constante = 4. En Dart convención: kMaxTargetDepth.' },
  TargetComposition:           { src: 'src/types.ts',         tests: 'tests/target-chain.test.ts' },
  ResolvedHop:                 { src: 'src/target-chain.ts',  tests: 'tests/target-chain.test.ts' },
  targetComposition:           { src: 'src/types.ts',         tests: 'tests/target-chain.test.ts',
    note: 'Campo opcional de ViewComposition. Parsear en fromJson.' },

  // ── Interactividad / decisor de tap (KRO-74) ────────────────────────────
  resolveTapAction:            { src: 'src/interaction.ts',   tests: 'tests/interaction.test.ts',
    note: 'Firma: (composition, item, {fieldDefs}) → TapResolution. Deps ya en Dart: ViewComposition, buildAutoDetailComposition, getRecipeManifest.' },
  resolveDetailComposition:    { src: 'src/interaction.ts',   tests: 'tests/interaction.test.ts',
    note: 'Prioridad: targetComposition → targetRecipe → buildAutoDetailComposition(fieldDefs).' },
  resolveTargetRecipe:         { src: 'src/interaction.ts',   tests: 'tests/interaction.test.ts',
    note: 'Auto-pick: galería→momento, imagen→hero_protagonico, solo texto→editorial.' },
  resolveExpandRecipe:         { src: 'src/interaction.ts',   tests: 'tests/interaction.test.ts',
    note: 'Auto-pick: con URL/email/phone→accordion_with_actions, resto→accordion_simple.' },
  isTappable:                  { src: 'src/interaction.ts',   tests: 'tests/interaction.test.ts' },
  opensNewScreen:              { src: 'src/interaction.ts',   tests: 'tests/interaction.test.ts' },
  TapResolution:               { src: 'src/interaction.ts',   tests: 'tests/interaction.test.ts',
    note: 'Sealed class / union Dart: none | navigate | modal | expand | external.' },
  ResolveTapOptions:           { src: 'src/interaction.ts',   tests: 'tests/interaction.test.ts',
    note: 'Clase/typedef con fieldDefs: List<FieldDefLike>? — necesaria para resolveTapAction.' },

  // ── Efectos visuales por valor de tag (KRO-30) ──────────────────────────
  TagStyle:                    { src: 'src/types.ts',                    tests: 'tests/visual-effects.test.ts',
    note: 'Mapeo valor-de-tag → efecto: { value, effect, config? }. Vive en albumSchema.tagStyles. Parsear en fromJson.' },
  VisualEffectDefinition:      { src: 'src/registries/visual-effects.ts', tests: 'tests/visual-effects.test.ts',
    note: 'Shape del catálogo: { id, displayName, description, layer, config[] }. layer ∈ overlay|badge|filter|border. El catálogo (6 efectos V1) está en visualEffects[] del .json del KRP — mirror desde ahí, NO hardcodear. El render del widget vive en kromia-flutter (lib/widgets/visual-effects/<id>.dart), NO en core_dart.' },
  allVisualEffects:            { src: 'src/registries/visual-effects.ts', tests: 'tests/visual-effects.test.ts',
    note: 'Accessor del catálogo. En Dart: leer visualEffects[] del .json embebido.' },
  getVisualEffect:             { src: 'src/registries/visual-effects.ts', tests: 'tests/visual-effects.test.ts',
    note: 'Lookup por id → VisualEffectDefinition | null. Necesario para el dispatcher effect→widget.' },
  isTagStyleValid:             { src: 'src/tag-styles.ts',                tests: 'tests/visual-effects.test.ts',
    note: 'Valida un TagStyle contra el catálogo (effect existe, config dentro del espacio del param). Pure.' },
  validateTagStyles:           { src: 'src/tag-styles.ts',                tests: 'tests/visual-effects.test.ts',
    note: 'Valida el array completo + avisa de valores de tag duplicados (warn). Devuelve { valid, issues[] }.' },

  // ── Fuente de rareza (KRO-28) ───────────────────────────────────────────
  RaritySource:                { src: 'src/types.ts',   tests: 'tests/rarity.test.ts',
    note: 'Vive en cardSchema.raritySource: { fieldKey, buckets: RarityBucket[] }. Parsear en fromJson.' },
  RarityBucket:                { src: 'src/types.ts',   tests: 'tests/rarity.test.ts',
    note: '{ value?: string (enum) | range?: [number,number] (rating), weight: number }.' },
  isFieldEligibleForRarity:    { src: 'src/rarity.ts',  tests: 'tests/rarity.test.ts',
    note: 'true si behavior ∈ rating|enum|ordinal_enum. Pure.' },
  validateRaritySource:        { src: 'src/rarity.ts',  tests: 'tests/rarity.test.ts',
    note: 'Valida raritySource vs fieldDefs (field existe+elegible, buckets, value xor range, weights). Devuelve { valid, issues[] }.' },
  rarityBucketForValue:        { src: 'src/rarity.ts',  tests: 'tests/rarity.test.ts',
    note: 'Dado un valor de carta → el bucket (por value enum o range rating). Necesario para el reparto ponderado en el cliente.' },
  normalizeRarityWeights:      { src: 'src/rarity.ts',  tests: 'tests/rarity.test.ts',
    note: 'Escala pesos a sumar 100 (equitativo si todos 0). Pure.' },
};

/** Todos los símbolos must-mirror (orden de SYMBOL_META). */
const MUST_MIRROR = Object.keys(SYMBOL_META);

// ─────────────────────────────────────────────────────────────────────────────

/** Lee recursivamente todo el .dart de un directorio y lo concatena. */
function readDartSources(dir) {
  let out = '';
  let entries;
  try { entries = readdirSync(dir); } catch { return null; }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out += readDartSources(full) ?? '';
    else if (name.endsWith('.dart'))   out += '\n' + readFileSync(full, 'utf8');
  }
  return out;
}

/** `MAX_TARGET_DEPTH` → candidatos Dart: camelCase + prefijo k. */
function camelFromScreaming(s) {
  const [first, ...rest] = s.toLowerCase().split('_');
  return first + rest.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}
function dartCandidates(sym) {
  if (/^[A-Z0-9_]+$/.test(sym) && sym.includes('_')) {
    const camel = camelFromScreaming(sym);
    return [sym, camel, 'k' + camel.charAt(0).toUpperCase() + camel.slice(1)];
  }
  return [sym];
}

// ─────────────────────────────────────────────────────────────────────────────
// Convención de versión: pubspec ≡ package.json (TS lidera, Dart sigue)
// ─────────────────────────────────────────────────────────────────────────────

let tsVersion = '?';
let dartVersion = '?';
try { tsVersion = JSON.parse(readFileSync(CORE_PKG_JSON, 'utf8')).version; } catch {}
try {
  const pubspec = readFileSync(DART_PUBSPEC, 'utf8');
  const m = /^version:\s*(\S+)/m.exec(pubspec);
  if (m) dartVersion = m[1];
} catch {}

// ─────────────────────────────────────────────────────────────────────────────

const strict = process.env.KRP_PARITY_STRICT === '1';
const dart   = readDartSources(CORE_DART_LIB);

if (dart == null) {
  console.log('::notice::core_dart/lib no existe todavía — parity DORMANT (KRO-65 aún no shipped).');
  process.exit(0);
}

const missing = MUST_MIRROR.filter(sym =>
  !dartCandidates(sym).some(c => new RegExp(`\\b${c}\\b`).test(dart)),
);

console.log(`KRP API parity TS↔Dart — ${MUST_MIRROR.length} símbolos must-mirror, ${missing.length} sin espejar.`);
console.log(`  Versiones: TS canónico = ${tsVersion} | core_dart = ${dartVersion}`);
if (tsVersion !== dartVersion) {
  console.log(`::warning::Versión de core_dart (${dartVersion}) ≠ TS canónico (${tsVersion}). CONVENCIÓN: pubspec.yaml#version debe igualar packages/core/package.json#version. El TS lidera — no bumpees pubspec de forma independiente.`);
}

if (missing.length === 0) {
  console.log('✅ Paridad de API OK — todos los símbolos contract-críticos están en core_dart.');
  process.exit(0);
}

console.log('');
console.log('Símbolos pendientes de espejar en core_dart:');
for (const sym of missing) {
  const meta = SYMBOL_META[sym];
  const src   = meta?.src   ? `  Fuente TS : packages/core/${meta.src}` : '';
  const tests = meta?.tests ? `  Corpus    : packages/core/${meta.tests}` : '';
  const note  = meta?.note  ? `  Nota      : ${meta.note}` : '';
  const lines = [src, tests, note].filter(Boolean).join(' | ');
  console.log(`::warning::${sym} — NO espejado en core_dart. ${lines}`);
}

console.log('');
if (strict) {
  console.error(`❌ FAIL (KRP_PARITY_STRICT): ${missing.length} símbolo(s) sin espejar: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`⚠️  WARN: ${missing.length} símbolo(s) sin espejar (no bloqueante). Pon KRP_PARITY_STRICT=1 para hacerlo gate duro.`);
process.exit(0);
