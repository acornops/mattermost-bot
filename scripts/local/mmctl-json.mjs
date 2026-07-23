#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function parseMmctlJson(raw) {
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return JSON.parse(trimmed);
}

function visit(value, callback) {
  if (Array.isArray(value)) {
    return value.some((entry) => visit(entry, callback));
  }
  if (value && typeof value === 'object') {
    if (callback(value)) return true;
    return Object.values(value).some((entry) => visit(entry, callback));
  }
  return false;
}

export function mmctlJsonHas(raw, field, expected) {
  const value = parseMmctlJson(raw);
  return visit(value, (entry) => String(entry[field] ?? '') === expected);
}

export function extractMmctlToken(raw) {
  const value = parseMmctlJson(raw);
  let token = '';
  visit(value, (entry) => {
    if (typeof entry.token === 'string' && entry.token) {
      token = entry.token;
      return true;
    }
    return false;
  });
  if (!token) throw new Error('mmctl JSON did not include an access token');
  return token;
}

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  const raw = readFileSync(0, 'utf8');
  if (mode === 'has' && args.length === 2) {
    process.exitCode = mmctlJsonHas(raw, args[0], args[1]) ? 0 : 1;
    return;
  }
  if (mode === 'token' && args.length === 0) {
    process.stdout.write(extractMmctlToken(raw));
    return;
  }
  throw new Error('Usage: mmctl-json.mjs has <field> <value> | token');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
