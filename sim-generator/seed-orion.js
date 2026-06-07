#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const args = parseArgs(process.argv.slice(2));
const inputFile = args.input || args.i;
const orionUrl = process.env.ORION_URL || process.env.ORION_HOST || args.orion || 'http://localhost:1026';

if (!inputFile) {
  console.error('Missing --input <path> argument');
  process.exit(1);
}

const inputPath = path.resolve(process.cwd(), inputFile);
if (!fs.existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`);
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
if (!Array.isArray(payload)) {
  console.error('Input file must be a JSON array of NGSI-v2 entities');
  process.exit(1);
}

const client = axios.create({ baseURL: orionUrl, timeout: 10000 });

async function main() {
  console.log(`Seeding ${payload.length} entities to Orion at ${orionUrl}`);
  let success = 0;
  for (const entity of payload) {
    try {
      await upsertEntity(entity);
      success += 1;
    } catch (error) {
      console.error(`Failed entity ${entity.id}:`, error.message || error);
    }
  }
  console.log(`Completed ${success}/${payload.length} upserts.`);
}

async function upsertEntity(entity) {
  const url = `/v2/entities?options=upsert`;
  try {
    await client.post(url, entity, {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    if (status === 409 || status === 422) {
      const attrs = { ...entity };
      delete attrs.id;
      delete attrs.type;
      const patchUrl = `/v2/entities/${encodeURIComponent(entity.id)}/attrs?options=append`;
      await client.post(patchUrl, attrs, {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      throw new Error(`HTTP ${status}: ${JSON.stringify(data)}`);
    }
  }
}

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        result[key] = next;
        i++;
      } else {
        result[key] = true;
      }
    }
  }
  return result;
}

main().catch(error => {
  console.error('Seed failed:', error.message || error);
  process.exit(1);
});
