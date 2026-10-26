// 로컬 MCP 서버 (stdio) — 이 PC의 search/dist/uipatterns.db 로 검색. 원격 서버와 같은 도구.
//   claude mcp add uipatterns -- node C:/Users/.../uipatterns/mcp/local.mjs
// 원격(Cloudflare) 배포 전에 검색 품질을 확인하거나, 회사 PC에서 바로 쓸 때.
import { DatabaseSync } from 'node:sqlite';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { handleMessage } from './src/server.js';

const file = process.env.UIP_DB || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'search', 'dist', 'uipatterns.db');

// 요청마다 열고 닫는다 — 서버가 켜져 있어도 업데이트.bat 이 검색 데이터를 새로 바꿔 끼울 수 있게
const rl = createInterface({ input: process.stdin });
rl.on('line', async line => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n'); }
  let sqlite;
  const db = { all: async (sql, params = []) => (sqlite ||= new DatabaseSync(file, { readOnly: true })).prepare(sql).all(...params) };
  try {
    const res = await handleMessage(msg, db);
    if (res) process.stdout.write(JSON.stringify(res) + '\n');
  } finally {
    sqlite?.close();
  }
});
