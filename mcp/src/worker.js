// 원격 MCP 서버 (Cloudflare Worker + D1) — 팀원이 Claude 커넥터로 연결하는 주소
//   POST https://<worker>.workers.dev/mcp   (Streamable HTTP, 세션 없이 요청마다 JSON 응답)
// 읽기 전용: D1 의 검색 데이터를 조회만 한다. 회사 서버(이미지)에는 요청하지 않는다.
import { handleMessage } from './server.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== '/mcp') {
      return new Response('UI Patterns MCP 서버입니다. Claude 커넥터에 이 주소 뒤에 /mcp 를 붙여 추가하세요.', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST', ...CORS } });

    let body;
    try { body = await req.json(); } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400); }

    const db = { all: async (sql, params = []) => (await env.DB.prepare(sql).bind(...params).all()).results };
    if (Array.isArray(body)) {
      const out = (await Promise.all(body.map(m => handleMessage(m, db)))).filter(Boolean);
      return out.length ? json(out) : new Response(null, { status: 202, headers: CORS });
    }
    const res = await handleMessage(body, db);
    return res ? json(res) : new Response(null, { status: 202, headers: CORS });
  },
};
