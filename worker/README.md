# 이미지 중계 (Cloudflare Worker)

사이트(github.io)와 이미지(회사 서버)의 주소가 달라서, 브라우저가 다운로드용 이미지 읽기를 막습니다.
회사 서버는 건드리지 않고, 이 Worker가 이미지를 받아 넘겨주면서 허용 헤더를 붙여줍니다.
화면 표시에는 쓰지 않고 **다운로드 버튼을 누를 때만** 거칩니다. 무료 한도는 하루 10만 건입니다.

## 처음 한 번 설정 (10분)

1. <https://dash.cloudflare.com/sign-up> 에서 무료 가입
2. Workers & Pages → Create → **Hello World** Worker 만들기 → 이름 `uipatterns-img`
3. **Edit code** → `image-proxy.js` 내용을 통째로 붙여넣기 → Deploy
4. 나온 주소(예: `https://uipatterns-img.<계정>.workers.dev`)를 저장소 루트 `config.js` 의 `imgProxy` 에 넣고 업데이트.bat 실행

여기까지면 끝입니다. 코드를 고칠 일이 거의 없으니 자동 배포는 선택입니다.

### (선택) worker/ 수정 시 자동 배포
- Cloudflare → My Profile → API Tokens → "Edit Cloudflare Workers" 템플릿으로 토큰 발급
- GitHub 저장소 → Settings → Secrets and variables → Actions
  - Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
  - Variables: `WORKER_ENABLED` = `true`
