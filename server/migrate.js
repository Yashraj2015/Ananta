#!/usr/bin/env node
'use strict';
/**
 * Migration runner — runs all .sql files in ./migrations in order.
 * Safe to run multiple times (uses IF NOT EXISTS).
 * Usage: node migrate.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.CTRL_PLANE_POOLER_URL || process.env.CTRL_PLANE_DIRECT,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  const migrDir = path.join(__dirname, 'migrations');
  const files   = fs.readdirSync(migrDir).filter(f => f.endsWith('.sql')).sort();

  console.log(`\nAnanta DB — running ${files.length} migration(s)\n`);

  let ok = 0, skip = 0, fail = 0;

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrDir, file), 'utf8');
    process.stdout.write(`  ${file} ... `);
    try {
      await pool.query(sql);
      console.log('✓');
      ok++;
    } catch (e) {
      if (e.code === '42P07' || e.message.includes('already exists')) {
        console.log('~ (already applied)');
        skip++;
      } else {
        console.log(`✗ ${e.message}`);
        fail++;
      }
    }
  }

  await pool.end();
  console.log(`\nResult: ${ok} applied, ${skip} skipped, ${fail} failed\n`);
  if (fail > 0) process.exit(1);
}

migrate().catch(e => { console.error(e.message); process.exit(1); });
