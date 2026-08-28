#!/usr/bin/env node
/**
 * db.mjs — run SQL against the linked Supabase project from the command line.
 *
 * Uses the Supabase Management API (the same endpoint the dashboard SQL editor
 * and the official Supabase MCP server use), so it needs a personal access
 * token (sbp_...) in .env as SUPABASE_ACCESS_TOKEN. Zero dependencies.
 *
 *   node scripts/db.mjs query "select count(*) from products"
 *   node scripts/db.mjs apply 0102              # applies supabase/migrations/0102_*.sql
 *   node scripts/db.mjs apply supabase/migrations/0102_two_factor_email.sql
 *   node scripts/db.mjs apply 0102 --dry        # print the SQL, send nothing
 *
 * NEVER use `supabase db push` on this project — see CLAUDE.md rule 1. This
 * script applies exactly one file, exactly when asked.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function envFile() {
  const out = {};
  let raw = '';
  try { raw = readFileSync(join(root, '.env'), 'utf8'); } catch { return out; }
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = { ...envFile(), ...process.env };
const token = env.SUPABASE_ACCESS_TOKEN;
let ref = env.SUPABASE_PROJECT_REF;
if (!ref) {
  try {
    ref = JSON.parse(readFileSync(join(root, 'supabase/.temp/linked-project.json'), 'utf8')).ref;
  } catch { /* fall through */ }
}

const [cmd, target] = process.argv.slice(2);
const dry = process.argv.includes('--dry');

function die(msg) { console.error(msg); process.exit(1); }

if (!cmd || !['query', 'apply'].includes(cmd)) {
  die('usage: node scripts/db.mjs <query|apply> <sql|migration> [--dry]');
}
if (!ref) die('No project ref. Set SUPABASE_PROJECT_REF in .env.');

let sql, label;
if (cmd === 'query') {
  if (!target) die('usage: node scripts/db.mjs query "select 1"');
  sql = target;
  label = 'query';
} else {
  const dir = join(root, 'supabase', 'migrations');
  let file = target;
  if (target && /^\d{4}[a-z]?$/.test(target)) {
    const hit = readdirSync(dir).filter((f) => f.startsWith(`${target}_`) && f.endsWith('.sql'));
    if (hit.length !== 1) die(`Expected exactly one migration starting ${target}_, found ${hit.length}.`);
    file = join(dir, hit[0]);
  }
  if (!file) die('usage: node scripts/db.mjs apply <0102|path/to.sql>');
  sql = readFileSync(isAbsolute(file) ? file : join(root, file), 'utf8');
  label = basename(file);
}

if (dry) {
  console.log(`-- ${label} (${sql.length} bytes) — DRY RUN, nothing sent\n`);
  console.log(sql);
  process.exit(0);
}
if (!token) die('No SUPABASE_ACCESS_TOKEN in .env. Create one at https://supabase.com/dashboard/account/tokens');

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
const text = await res.text();
if (!res.ok) {
  console.error(`✗ ${label} — HTTP ${res.status}`);
  console.error(text);
  process.exit(1);
}
let rows;
try { rows = JSON.parse(text); } catch { rows = text; }
console.log(`✓ ${label}`);
console.log(typeof rows === 'string' ? rows : JSON.stringify(rows, null, 2).slice(0, 8000));
