// UI Patterns 공용 설정 (mo/web 페이지가 함께 읽는다)
window.UIP_CONFIG = {
  // 이미지 원본 위치 — 회사 서버. 그 아래 mo/·web/ 폴더에 카테고리별 이미지와 icons/가 있다.
  // index.html을 파일로 직접 열면(file://) 이 PC의 이미지 폴더를 쓴다 → 서버 업로드 전에 미리 확인 가능.
  imgBase: location.protocol === 'file:'
    ? '../'
    : 'https://imagesisa.ybmnet.co.kr/platform/design_ybmnet_co_kr/uipatterns/',

  // 이미지 중계(Cloudflare Worker) 주소 — 다운로드할 때만 쓴다. worker/README.md 참고.
  // 비워두면 다운로드 버튼이 이미지를 새 창으로 연다.
  imgProxy: '',
};
