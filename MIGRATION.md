# Next.js 마이그레이션 노트

## 현재 구조

```
portfolio/
├── app/
│   ├── api/finnhub/[...path]/route.ts  # Finnhub 서버 프록시
│   ├── open/                           # 실제 포트폴리오 앱
│   ├── v2/page.tsx                     # /open 리다이렉트
│   ├── layout.tsx
│   ├── page.tsx                        # 랜딩 페이지
│   └── globals.css
├── lib/firebase.ts                     # 기존 Firebase 프로젝트·DB 경로 호환
├── lib/demoShare.ts                    # /open 공유 화면 데모 URL
├── next.config.js
└── vercel.json
```

레거시 HTML 진입점은 제거했고, `/open`이 Next.js App Router 기반 실제 앱입니다.

## 데이터 호환성

- Firebase 프로젝트: `swing-dh`
- RTDB 경로: `users/{uid}/ptf`
- 데이터 키: `h`(holdings), `w`(watch), `j`(journal), `hi`(history), `c`(cash)
- 보안 규칙: `$uid === auth.uid`

Firebase 데이터 경로와 단축 키는 기존 사용자 데이터 호환을 위해 유지합니다.

## 로컬 개발

```bash
npm install
npm run dev
```

- 랜딩: `http://localhost:3000`
- 앱: `http://localhost:3000/open`
- 데모: `http://localhost:3000/open?demo=1`

## 배포

Vercel은 `vercel.json`의 Next.js 설정을 사용합니다.

필수 환경변수:

- `FINNHUB_API_KEY`: 시세, 뉴스, 실적 일정 서버 프록시에서 사용

선택 환경변수:

- `NEXT_PUBLIC_FIREBASE_*`: 비워두면 `lib/firebase.ts`의 기본값 사용

## 완료된 주요 개선

- 레거시 HTML 제거 및 `/open` Next.js 앱 이식
- 티커 입력/표기 정리, 입력 대문자 처리
- 필수/선택 입력 표시
- 목표가/손절가 상태 배지
- 실적 일정 자동 로드, 지난 7일~향후 3주 범위, BEAT/MISS 표시
- 상세 패널 확장: 보유 요약, 목표/손절 거리, 가까운 실적, 뉴스, TradingView 링크
- 다크 모드
- 예수금 팝업 수정
- 공유 링크 표시 잔류 제거
- 보유 종목 테이블 정렬
- 백업 JSON 불러오기 UI 제거
- 공유 요약 기반 PDF 내보내기
- 자산 비중 도넛 그래프, 자산 추이 그래프, 변화율 표시
- 관심 종목 탭 실적 일정 추가
- 매수/매도 색상 구분

## 보안 모델

- 클라이언트는 Firebase ID 토큰을 `Authorization: Bearer ...` 헤더로 전송
- 서버가 Google JWKS로 토큰 서명 검증
- 검증 통과 시에만 Finnhub로 forward
- Finnhub API 키는 서버 환경변수에만 존재
