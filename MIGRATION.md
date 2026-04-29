# Next.js 마이그레이션 노트

## 폴더 구조

```
portfolio/
├── ai_studio_code2.1.html   # 원본 (백업용으로 보존)
├── public/legacy/index.html # 실제 서비스되는 legacy 진입점
├── app/
│   ├── layout.tsx           # 루트 레이아웃
│   ├── page.tsx             # / — rewrite로 거의 닿지 않음 (폴백)
│   ├── v2/page.tsx          # /v2 — 새 버전 미리보기 (Phase 2부터 채움)
│   └── globals.css
├── lib/firebase.ts          # legacy와 동일한 Firebase 설정·DB 경로
├── next.config.js           # rewrites: / → /legacy/index.html
└── ...
```

## 데이터 호환성 — 절대 깨면 안 되는 약속

- Firebase 프로젝트: `swing-dh` (legacy와 동일)
- RTDB 경로: `users/{uid}/ptf`
- 데이터 키: `h`(holdings), `w`(watch), `j`(journal), `hi`(history), `c`(cash), `k`(api key — Phase 3에서 제거)
- 보안 규칙: `$uid === auth.uid` (이미 적용됨, 변경 불요)

기존 앱과 새 v2 앱이 같은 데이터를 읽고 쓰므로, 친구들이 어느 쪽을 사용해도 데이터가 보존됩니다.

## 로컬 개발

```bash
npm install
npm run dev
# http://localhost:3000  → legacy
# http://localhost:3000/v2 → 새 버전
```

## 배포 (Vercel)

`package.json`이 추가되었으므로 Vercel은 자동으로 Next.js 빌드로 전환됩니다.

1. Vercel 대시보드에서 Framework Preset이 "Next.js"로 인식되는지 확인
2. (선택) Environment Variables에 `NEXT_PUBLIC_FIREBASE_*` 설정 — 비워두면 `lib/firebase.ts`의 기본값 사용
3. 배포 후 확인:
   - `/` → 기존 HTML 그대로 보여야 함
   - `/v2` → 새 미리보기 페이지

## 단계별 진행

| Phase | 상태 | 내용 |
|---|---|---|
| 0 | ✅ | HTML 핫픽스 (매수날짜 동기화, PDF, 보유/관심 개별 import·export, TradingView) |
| 1 | ✅ | Next.js 스캐폴딩 + legacy 보존 |
| 2 | ✅ | 랜딩 페이지(#7) + 데모 모드 + /open URL |
| 3 | ✅ | Finnhub API 서버 프록시(#8) — 공용 키, 토큰 검증, edge 캐싱 |
| 4 | ✅ | 도메인 컷오버 (루트 index.html 제거, /v2 → /open 리다이렉트, 상태 페이지 완료 표시) |

## Phase 3: Vercel 환경변수 설정 (필수)

서버 프록시가 동작하려면 Vercel에 Finnhub API 키를 등록해야 합니다.

1. [Vercel 프로젝트 → Settings → Environment Variables](https://vercel.com/dashboard) 이동
2. 새 변수 추가:
   - **Name**: `FINNHUB_API_KEY`
   - **Value**: 본인 Finnhub 계정의 API 키
   - **Environments**: Production, Preview, Development 모두 체크
3. 저장 후 **재배포** (Deployments → 최신 → ⋯ → Redeploy) 또는 다음 push로 자동 반영

설정이 빠진 경우 `/api/finnhub/*` 호출이 500 에러를 반환하며 본문에 안내 메시지가 들어옵니다.

### 보안 모델
- 클라이언트는 자기 Firebase ID 토큰을 `Authorization: Bearer ...` 헤더로 보냄
- 서버가 Google JWKS로 서명 검증 (admin SDK 불필요, `jose` 라이브러리 사용)
- 검증 통과 시에만 Finnhub로 forward, 응답은 Vercel CDN에 짧게 캐시 (시세 30s, 뉴스 5m, 어닝 30m)
- API 키는 서버 환경변수에만 존재, 응답 본문/헤더 어디에도 노출 안 됨

## 롤백 방법

문제 발생 시:
1. `next.config.js`의 rewrites는 그대로 두고 `app/`, `lib/`, `public/legacy/` 외 새 파일만 제거하면 legacy로 100% 복귀
2. 가장 강한 롤백: `package.json`, `next.config.js`, `app/`, `lib/`, `public/`을 모두 삭제하고 root에 `ai_studio_code2.1.html`만 두면 원래 정적 사이트로 돌아감
