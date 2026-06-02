/**
 * KRO-118 — Drift de PARIDAD DE API TS↔Dart (3ª capa del drift CI).
 *
 * Punto ciego de KRO-64 (version-drift + corpus): una feature ADDITIVE solo-TS
 * (export nuevo / campo opcional, SIN bump de versión) no la caza nadie —
 * version-drift ve el mismo número y el corpus solo cubre lo YA espejado. Esta
 * capa lo cierra: comprueba que cada símbolo CONTRACT-CRÍTICO del SDK TS tiene
 * contraparte (por nombre) en `core_dart`. Lo que falte → aviso.
 *
 * Modo:
 *   - default (WARN): imprime ::warning:: por cada hueco y sale 0 (no rompe main
 *     mientras Flutter se pone al día).
 *   - `KRP_PARITY_STRICT=1` (FAIL): sale 1 si hay huecos (gate duro cuando se decida).
 *
 * `must-mirror` es CURADO a propósito (no "todos los exports"): core_dart es un
 * subconjunto intencional (hay helpers solo-Studio). Añadir un símbolo aquí ES
 * el acto deliberado de decir "Flutter necesita esto". v1 = presencia por nombre
 * (no firma completa).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE_DART_LIB = join(__dirname, '..', '..', 'core_dart', 'lib');

/**
 * Símbolos TS que `core_dart` DEBE espejar para renderizar/validar bien.
 * Añade aquí cuando un export/tipo nuevo del SDK sea relevante para Flutter.
 */
const MUST_MIRROR = [
  // Clasificación + compatibilidad
  'classifyField', 'isFieldCompatibleWithSlot', 'isCompatible', 'compareSemver',
  // Validación
  'validateComposition',
  // Presentación (render del AppPreview / cliente)
  'formatScalar', 'buildAutoDetailComposition', 'buildAutoListComposition',
  'composeSlotValues', 'extractAccentSettings', 'synthSectionItems',
  // Versionado de schema
  'isSchemaOutdated',
  // KRO-94 Fase B — cadena multi-salto
  'resolveTargetChain', 'targetChainDepth', 'MAX_TARGET_DEPTH',
  // Tipos / campos clave (no son exports de valor, se comprueban por nombre)
  'TargetComposition', 'ResolvedHop', 'targetComposition',
];

/** Lee recursivamente todo el .dart de un directorio y lo concatena. */
function readDartSources(dir) {
  let out = '';
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return null; // core_dart aún no existe (detector dormant, como KRO-64)
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out += readDartSources(full) ?? '';
    } else if (name.endsWith('.dart')) {
      out += '\n' + readFileSync(full, 'utf8');
    }
  }
  return out;
}

const strict = process.env.KRP_PARITY_STRICT === '1';
const dart = readDartSources(CORE_DART_LIB);

if (dart == null) {
  console.log('::notice::core_dart/lib no existe todavía — parity DORMANT (KRO-65 aún no shipped).');
  process.exit(0);
}

/** `MAX_TARGET_DEPTH` → `maxTargetDepth` (camelCase Dart). */
function camelFromScreaming(s) {
  const [first, ...rest] = s.toLowerCase().split('_');
  return first + rest.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

/**
 * Formas Dart aceptables para un símbolo TS. Las funciones/clases mantienen el
 * nombre (camelCase/PascalCase 1:1); las constantes SCREAMING_SNAKE se vuelven
 * camelCase y, por convención Dart, suelen llevar prefijo `k`.
 */
function dartCandidates(sym) {
  if (/^[A-Z0-9_]+$/.test(sym) && sym.includes('_')) {
    const camel = camelFromScreaming(sym);
    return [sym, camel, 'k' + camel.charAt(0).toUpperCase() + camel.slice(1)];
  }
  return [sym];
}

const missing = MUST_MIRROR.filter(sym =>
  !dartCandidates(sym).some(c => new RegExp(`\\b${c}\\b`).test(dart)),
);

console.log(`KRP API parity TS↔Dart — ${MUST_MIRROR.length} símbolos must-mirror, ${missing.length} sin espejar.`);

if (missing.length === 0) {
  console.log('✅ Paridad de API OK — todos los símbolos contract-críticos están en core_dart.');
  process.exit(0);
}

for (const sym of missing) {
  // ::warning:: (GitHub Actions lo convierte en anotación). En local solo es texto.
  console.log(`::warning::Símbolo "${sym}" del SDK TS NO está espejado en core_dart (Flutter debe añadirlo).`);
}

if (strict) {
  console.error(`❌ FAIL (KRP_PARITY_STRICT): ${missing.length} símbolo(s) sin espejar: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`⚠️  WARN: ${missing.length} símbolo(s) sin espejar (no bloqueante). Pon KRP_PARITY_STRICT=1 para hacerlo gate duro.`);
process.exit(0);
