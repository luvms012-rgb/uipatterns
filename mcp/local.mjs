// 로컬 MCP 서버 (stdio) — 이 PC의 search/dist/uipatterns.db 로 검색. 원격 서버와 같은 도구.
//   claude mcp add uipatterns -- node C:/Users/.../uipatterns/mcp/local.mjs
// 원격(Cloudflare) 배포 전에 검색 품질을 확인하거나, 회사 PC에서 바로 쓸 때.
import { DatabaseSync } from 'node:sqlite';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { handleMessage } from './src/server.js';

const file = process.env.UIP_DB || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'search', 'dist', 'uipatterns.db');
const sqlite = new DatabaseSync(file, { readOnly: true });
const db = { all: async (sql, params = []) => sqlite.prepare(sql).all(...params) };

const rl = createInterface({ input: process.stdin });
rl.on('line', async line => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n'); }
  const res = await handleMessage(msg, db);
  if (res) process.stdout.write(JSON.stringify(res) + '\n');
});
