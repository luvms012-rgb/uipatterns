// MCP 요청 처리 (JSON-RPC) — 원격(worker.js)과 로컬(local.mjs)이 함께 쓴다
import { TOOLS, INSTRUCTIONS } from './tools.js';

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const INFO = { name: 'uipatterns', title: 'UI Patterns 화면 검색', version: '0.1.0' };

const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

// 응답이 필요 없는 알림이면 null
export async function handleMessage(msg, db) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return fail(msg?.id ?? null, -32600, 'Invalid Request');
  const { id, method, params = {} } = msg;
  if (id === undefined || id === null) return null;   // notifications/initialized 등

  switch (method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: INFO,
        instructions: INSTRUCTIONS,
      });
    case 'ping':
      return ok(id, {});
    case 'tools/list':
      return ok(id, { tools: TOOLS.map(({ run, ...t }) => t) });
    case 'tools/call': {
      const tool = TOOLS.find(t => t.name === params.name);
      if (!tool) return fail(id, -32602, `Unknown tool: ${params.name}`);
      try {
        const data = await tool.run(db, params.arguments || {});
        return ok(id, { content: [{ type: 'text', text: JSON.stringify(data, null, 1) }], structuredContent: data });
      } catch (e) {
        return ok(id, { content: [{ type: 'text', text: '오류: ' + (e?.message || e) }], isError: true });
      }
    }
    default:
      return fail(id, -32601, `Method not found: ${method}`);
  }
}
