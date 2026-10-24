// 이미지 중계 (Cloudflare Worker)
// 회사 서버 이미지에는 CORS 헤더가 없어서 github.io 페이지가 파일 내용을 읽을 수 없다(다운로드 불가).
// 이 Worker가 회사 서버에서 이미지를 받아 CORS 헤더를 붙여 돌려준다. 회사 서버는 건드리지 않는다.
//
//   GET https://<worker>.workers.dev/mo/검색/토스_검색_001_20260101.png
//     → https://imagesisa.ybmnet.co.kr/platform/design_ybmnet_co_kr/uipatterns/mo/검색/토스_검색_001_20260101.png
//
// 아무 파일이나 받아가는 통로가 되지 않도록 uipatterns 아래 mo/·web/ 이미지만 허용한다.

const ORIGIN = 'https://imagesisa.ybmnet.co.kr/platform/design_ybmnet_co_kr/uipatterns/';
const ALLOWED_ORIGINS = ['https://luvms012-rgb.github.io', 'http://localhost', 'http://127.0.0.1'];
const PATH_RE = /^\/(mo|web)\/[^?#]+\.(png|jpe?g|webp|gif|avif)$/i;

function corsHeaders(req) {
  const origin = req.headers.get('Origin') || '';
  const ok = ALLOWED_ORIGINS.some(o => origin === o || origin.startsWith(o + ':'));
  return ok ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {};
}

export default {
  async fetch(req) {
    const cors = corsHeaders(req);
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, HEAD', 'Access-Control-Max-Age': '86400' } });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });

    const url = new URL(req.url);
    if (!PATH_RE.test(decodeURIComponent(url.pathname)) || url.pathname.includes('..')) {
      return new Response('Not found', { status: 404, headers: cors });
    }

    const upstream = await fetch(ORIGIN + url.pathname.slice(1), {
      method: req.method,
      cf: { cacheEverything: true, cacheTtl: 86400 },  // 같은 이미지는 하루 동안 Cloudflare 캐시에서 응답
    });
    const headers = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
