'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { demoShareUrl } from '@/lib/demoShare';

export default function Landing() {
  // 로그인된 사용자는 랜딩 잠깐 깜빡 후 곧장 /app으로.
  // 비로그인은 그대로 랜딩을 봄. SSR 시점에는 항상 랜딩 마크업이 나가므로 SEO/초기 렌더 정상.
  useEffect(() => {
    const unsub = onAuthStateChanged(getFirebaseAuth(), (user) => {
      if (user) window.location.replace('/open');
    });
    return () => unsub();
  }, []);

  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <Features />
      <Showcase />
      <CTA />
      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-bg/70 border-b border-border">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">📊</span>
          <span className="font-bold tracking-tight">스윙 포트폴리오 트래커</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={demoShareUrl}
            className="hidden sm:inline-flex text-sm font-medium text-sub hover:text-text px-3 py-2"
          >
            데모 둘러보기
          </a>
          <a
            href="/open"
            className="inline-flex items-center gap-1.5 text-sm font-semibold bg-brand text-white px-4 py-2 rounded-lg hover:opacity-90 transition"
          >
            시작하기 <span aria-hidden>→</span>
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-blue-950/30 dark:via-transparent dark:to-indigo-950/30" />
      <div className="max-w-6xl mx-auto px-6 pt-20 pb-24 sm:pt-28 sm:pb-32 text-center">
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-brand bg-brand/10 px-3 py-1 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-brand" /> 미국 스윙 트레이더를 위한 도구
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
          포트폴리오를{' '}
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            한 눈에
          </span>
          <br />
          기록하고, 분석하고, 공유하세요
        </h1>
        <p className="mt-6 text-base sm:text-lg text-sub max-w-2xl mx-auto leading-relaxed">
          실시간 시세 · 매매 일지 · 보유 기간 · 목표가 알림 · TradingView 워치리스트 연동까지.
          복잡한 스프레드시트 대신, 스윙 트레이딩에 최적화된 단일 화면.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="/open"
            className="inline-flex items-center justify-center gap-2 bg-brand text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition shadow-lg shadow-brand/20"
          >
            <GoogleIcon /> Google로 시작 (무료)
          </a>
          <a
            href={demoShareUrl}
            className="inline-flex items-center justify-center gap-2 bg-card border border-border text-text font-semibold px-6 py-3 rounded-xl hover:bg-bg transition"
          >
            <span>👀</span> 로그인 없이 데모 보기
          </a>
        </div>
        <p className="mt-4 text-xs text-sub">
          Google 계정만 있으면 즉시 사용 · 데이터는 본인만 접근 가능
        </p>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: '💼',
      title: '보유 종목 관리',
      desc: '수량·평단가·목표가·손절가를 한 곳에. 실시간 수익률과 비중 자동 계산.',
    },
    {
      icon: '📓',
      title: '매매 일지 + 자동 연동',
      desc: '거래 한 번 기록하면 보유 수량·평단가·예수금까지 자동 업데이트. 매수일도 함께.',
    },
    {
      icon: '👀',
      title: '관심 종목 + TradingView 연동',
      desc: '워치리스트를 TradingView와 양방향 동기화. 목표 진입가 도달 시 알림 표시.',
    },
    {
      icon: '📅',
      title: '실적 발표 캘린더',
      desc: '보유·관심 종목의 어닝 일정을 자동 수집. 일정 충돌·리스크 한눈에 확인.',
    },
    {
      icon: '⏱️',
      title: '보유 기간 추적',
      desc: '최초 매수일부터 D+N 자동 표시. 단기/중기 색상 배지로 회전율 한눈에.',
    },
    {
      icon: '🔗',
      title: '공유 + PDF 내보내기',
      desc: '금액 비공개, 수익률·비중만 공유. 링크 또는 PDF 어디든 보낼 수 있음.',
    },
  ];

  return (
    <section className="py-20 sm:py-24 border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            트레이더가 실제로 쓰는 기능만
          </h2>
          <p className="mt-3 text-sub">
            화면 가득한 차트나 추천 알고리즘 대신, 매일 들여다보게 되는 6가지에 집중했습니다.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {items.map((it) => (
            <div
              key={it.title}
              className="rounded-2xl border border-border bg-card p-6 hover:border-brand/40 hover:shadow-lg hover:shadow-brand/5 transition"
            >
              <div className="text-3xl mb-3">{it.icon}</div>
              <h3 className="font-semibold text-base mb-1.5">{it.title}</h3>
              <p className="text-sm text-sub leading-relaxed">{it.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Showcase() {
  return (
    <section className="py-20 sm:py-24 border-t border-border bg-gradient-to-b from-transparent to-blue-50/40 dark:to-blue-950/20">
      <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="text-xs font-semibold text-brand uppercase tracking-wider mb-3">데모</div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            로그인 없이 먼저 둘러보세요
          </h2>
          <p className="text-sub leading-relaxed mb-6">
            샘플 포트폴리오로 공유 화면이 어떻게 보이는지 즉시 확인할 수 있습니다.
            본인 데이터로는 Google 로그인 후 자유롭게 추가/수정/삭제 가능.
          </p>
          <ul className="space-y-2.5 text-sm mb-8">
            {[
              'Google 계정 외 별도 가입 절차 없음',
              '본인 데이터는 Firebase에서 본인 UID로만 접근',
              '백업/복원 자유 — 언제든 JSON으로 내보내고 가져오기',
              '친구가 만든 포트폴리오를 AI에게 정리시켜 그대로 가져올 수 있는 포맷 제공',
            ].map((x) => (
              <li key={x} className="flex items-start gap-2">
                <span className="mt-0.5 text-gain shrink-0">✓</span>
                <span>{x}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={demoShareUrl}
              className="inline-flex items-center justify-center gap-2 bg-brand text-white font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition"
            >
              👀 데모 공유 화면 열기
            </a>
            <a
              href="/open"
              className="inline-flex items-center justify-center gap-2 bg-card border border-border font-semibold px-5 py-2.5 rounded-lg hover:bg-bg transition"
            >
              내 계정으로 시작하기
            </a>
          </div>
        </div>
        <div className="relative">
          <div className="rounded-2xl border border-border bg-card shadow-2xl p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="text-center flex-1">
                <div className="text-2xl font-extrabold text-gain">+14.32%</div>
                <div className="text-xs text-sub mt-1">총 수익률</div>
              </div>
              <div className="text-center flex-1 border-l border-border">
                <div className="text-2xl font-extrabold">8 종목</div>
                <div className="text-xs text-sub mt-1">보유 중</div>
              </div>
            </div>
            <div className="space-y-1">
              {[
                ['NVDA', 'NVIDIA Corp', 32.18, 24.5],
                ['AAPL', 'Apple Inc.', 12.4, 18.2],
                ['MSFT', 'Microsoft Corp', 8.95, 15.7],
                ['GOOGL', 'Alphabet Inc.', 19.62, 12.4],
                ['TSLA', 'Tesla, Inc.', -4.21, 9.8],
                ['AMD', 'Advanced Micro Devices', 22.85, 8.6],
              ].map(([t, n, p, w]) => (
                <div
                  key={t as string}
                  className="flex items-center justify-between py-2.5 border-b border-border last:border-b-0"
                >
                  <div>
                    <div className="font-bold text-brand text-sm">{t}</div>
                    <div className="text-[10px] text-sub">{n}</div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-sm font-bold ${
                        (p as number) >= 0 ? 'text-gain' : 'text-loss'
                      }`}
                    >
                      {(p as number) >= 0 ? '+' : ''}
                      {(p as number).toFixed(2)}%
                    </div>
                    <div className="text-[10px] text-sub">비중 {w}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-sub bg-bg px-2">
            실제 공유 화면 미리보기
          </div>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-20 sm:py-24 border-t border-border">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          오늘부터 기록을 시작하세요
        </h2>
        <p className="text-sub mb-8">
          Google 계정으로 로그인하면 1초 안에 사용 시작. 별도 가입·결제·앱 설치 없음.
        </p>
        <a
          href="/open"
          className="inline-flex items-center justify-center gap-2 bg-brand text-white font-semibold px-7 py-3.5 rounded-xl hover:opacity-90 transition shadow-lg shadow-brand/20 text-base"
        >
          <GoogleIcon /> Google로 시작
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-sub">
        <div>© {new Date().getFullYear()} 스윙 포트폴리오 트래커</div>
        <div className="flex items-center gap-4">
          <a href={demoShareUrl} className="hover:text-text">데모</a>
          <a href="/open" className="hover:text-text">앱 열기</a>
          <a href="/v2" className="hover:text-text">v2 미리보기</a>
        </div>
      </div>
    </footer>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#fff"
        d="M9 7.4v3.4h4.7c-.2 1.2-1.4 3.4-4.7 3.4-2.8 0-5.1-2.3-5.1-5.2S6.2 3.8 9 3.8c1.6 0 2.7.7 3.3 1.3l2.3-2.2C13.1 1.6 11.2.7 9 .7 4.4.7.7 4.4.7 9s3.7 8.3 8.3 8.3c4.8 0 8-3.4 8-8.1 0-.5-.1-1-.1-1.4H9z"
      />
    </svg>
  );
}
