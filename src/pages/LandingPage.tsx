import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Sparkles,
  ShieldOff,
  Clock,
  BarChart,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

const COLORS = {
  bgDark: '#0A0A0F',
  bgSlate: '#0F172A',
  bgFooter: '#020209',
  white: '#ffffff',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  cardBg: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.1)',
};

const sectionPadding: React.CSSProperties = { padding: '96px 0' };

const containerStyle: React.CSSProperties = {
  maxWidth: '1152px',
  margin: '0 auto',
  padding: '0 24px',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: COLORS.cardBg,
  border: `1px solid ${COLORS.cardBorder}`,
  borderRadius: '16px',
  backdropFilter: 'blur(8px)',
};

const problems = [
  {
    emoji: '😤',
    title: '광고비는 나가는데 전화·주문·예약이 없다',
    desc: '클릭은 되는데 실제 고객이 아닌 봇이나 경쟁사 직원이 클릭하고 있을 수 있습니다. 부정클릭은 광고비를 낭비하고 광고 품질지수까지 낮춥니다. 병원·쇼핑몰·부동산·음식점 할 것 없이 모두 피해를 입습니다.',
  },
  {
    emoji: '😰',
    title: '경쟁사는 항상 상위에 있는데 나는 밀린다',
    desc: '경쟁사는 자동입찰 솔루션으로 24시간 순위를 관리합니다. 수동으로 하루 한 번 확인하는 동안 이미 수십 번 밀려납니다.',
  },
  {
    emoji: '😱',
    title: '광고비를 올려도 성과가 안 나온다',
    desc: '키워드별 최적 입찰가를 모르면 돈만 낭비합니다. 너무 낮으면 노출이 안 되고, 너무 높으면 수익이 없습니다.',
  },
];

const causes = [
  {
    icon: ShieldOff,
    iconColor: '#F87171',
    iconBg: 'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.25)',
    title: '부정클릭 — 광고비의 평균 15~30%가 낭비됩니다',
    desc: '경쟁사, 봇, 클릭 농장이 하루 수십 번 클릭합니다. 전화·주문·예약은 없는데 클릭비용만 나갑니다. 네이버는 사후 환급을 해주지만 기준이 까다롭고 이미 품질지수는 떨어진 후입니다.',
  },
  {
    icon: Clock,
    iconColor: '#FB923C',
    iconBg: 'rgba(249,115,22,0.1)',
    border: 'rgba(249,115,22,0.25)',
    title: '수동 입찰 — 잠자는 사이 경쟁사에 밀립니다',
    desc: '광고 경매는 24시간 진행됩니다. 아침에 확인하고 저녁에 조정하는 동안 경쟁사 자동입찰 시스템은 10분마다 최적화합니다.',
  },
  {
    icon: BarChart,
    iconColor: '#A78BFA',
    iconBg: 'rgba(139,92,246,0.1)',
    border: 'rgba(139,92,246,0.25)',
    title: '비효율 키워드 — 노출 0회 키워드에 돈이 나갑니다',
    desc: '전체 키워드의 30~40%는 노출조차 안 됩니다. 그런데 입찰가는 계속 나갑니다. 이걸 모르면 매달 수십만원이 증발합니다.',
  },
];

const solutions = [
  {
    icon: ShieldCheck,
    color: '#60A5FA',
    bg: 'rgba(59,130,246,0.1)',
    title: 'AI 부정클릭 실시간 차단',
    items: [
      '의심 IP 실시간 탐지',
      '동일 IP 반복클릭 자동 차단',
      '네이버 광고시스템에 즉시 반영',
      '월간 절감 리포트 자동 발송',
    ],
  },
  {
    icon: TrendingUp,
    color: '#34D399',
    bg: 'rgba(16,185,129,0.1)',
    title: '24시간 자동입찰 최적화',
    items: [
      '10분마다 현재 순위 확인',
      '목표 순위에 맞게 자동 입찰가 조정',
      '최대 입찰가 초과 방지',
      '시간대별 입찰 전략 적용',
    ],
  },
  {
    icon: Sparkles,
    color: '#A78BFA',
    bg: 'rgba(139,92,246,0.1)',
    title: 'AI 광고 성과 분석',
    items: [
      '비효율 키워드 자동 감지',
      '광고비 낭비 구간 분석',
      'AI 입찰가 조정 제안',
      '매주 월요일 자동 리포트',
    ],
  },
];

const industries = [
  { emoji: '🏥', name: '병원·의원', desc: '예약 없는 클릭 차단 + 시술 키워드 자동 순위 관리' },
  { emoji: '🏠', name: '부동산·분양', desc: '분양 문의 늘리기 + 경쟁 단지 대비 노출 우위 확보' },
  { emoji: '🛍', name: '쇼핑몰·이커머스', desc: '구매 전환 없는 클릭 제거 + 상품 키워드 최적 입찰' },
  { emoji: '🍽', name: '음식점·서비스업', desc: '예약·주문 늘리기 + 지역 키워드 상위 노출 유지' },
];

const stats = [
  { value: '99.2%', label: '부정클릭 차단율' },
  { value: '23%', label: '평균 광고비 절감' },
  { value: '98.3%', label: '자동입찰 적중률' },
  { value: '3분', label: '평균 설치 시간' },
];

type PlanStyle = 'free' | 'normal' | 'highlight';

const plans: {
  name: string;
  price: string;
  desc: string;
  features: string[];
  cta: string;
  badge?: string;
  style: PlanStyle;
}[] = [
  {
    name: 'Free',
    price: '0',
    desc: '지금 바로 시작',
    features: ['부정클릭 탐지 (무제한)', 'IP 차단 월 3개', 'AI 분석 월 1회', '클릭 로그 3일 보관'],
    cta: '무료로 시작',
    badge: '신용카드 불필요',
    style: 'free',
  },
  {
    name: 'Starter',
    price: '9,900',
    desc: '소규모 광고주',
    features: ['IP 차단 무제한', 'AI 분석 월 30회', '자동입찰 키워드 50개', '환급 CSV 다운로드'],
    cta: '시작하기',
    style: 'normal',
  },
  {
    name: 'Growth',
    price: '24,900',
    desc: '성장 중인 비즈니스',
    badge: '가장 인기',
    features: ['Starter 전부 포함', '구글 광고 연동', '키워드 자동 확장', 'AI 주간 리포트'],
    cta: '시작하기',
    style: 'highlight',
  },
  {
    name: 'Pro',
    price: '49,900',
    desc: '대규모·대행사용',
    features: ['Growth 전부 포함', 'Meta · YouTube 연동', 'AI 분석 무제한', '다중 사이트 (5개)'],
    cta: '시작하기',
    style: 'normal',
  },
];

const gradientText: React.CSSProperties = {
  background: 'linear-gradient(135deg, #60A5FA, #A78BFA)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

export function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: COLORS.bgDark, color: COLORS.white }}>
      {/* Navigation */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(12px)',
          backgroundColor: 'rgba(0,0,0,0.5)',
          borderBottom: `1px solid ${COLORS.cardBorder}`,
        }}
      >
        <div
          style={{
            ...containerStyle,
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <img src="/logo.svg" alt="A" width={32} height={32} style={{ width: 32, height: 32, borderRadius: 8 }} />
            <span style={{ color: COLORS.white, fontWeight: 600, fontSize: 18 }}>AdConcent</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Link to="/login" style={{ fontSize: 14, color: COLORS.gray400, textDecoration: 'none' }}>
              로그인
            </Link>
            <Link
              to="/signup"
              style={{
                fontSize: 14,
                backgroundColor: '#2563EB',
                color: COLORS.white,
                padding: '8px 16px',
                borderRadius: 8,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              무료 시작
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          background:
            'radial-gradient(ellipse at center, rgba(37,99,235,0.18) 0%, transparent 70%), #0A0A0F',
        }}
      >
        <div style={{ ...containerStyle, maxWidth: 960, padding: '96px 24px', textAlign: 'center', position: 'relative' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              borderRadius: 999,
              border: '1px solid rgba(59,130,246,0.3)',
              backgroundColor: 'rgba(59,130,246,0.05)',
              marginBottom: 32,
            }}
          >
            <Sparkles style={{ width: 14, height: 14, color: '#60A5FA' }} />
            <span style={{ fontSize: 12, color: '#93C5FD', fontWeight: 500 }}>✦ 네이버 광고 자동화 솔루션</span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(40px, 6vw, 72px)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              marginBottom: 24,
              lineHeight: 1.1,
              color: COLORS.white,
            }}
          >
            광고비는 나가는데
            <br />
            전화·주문·예약이 <span style={gradientText}>안 오는 이유</span>
          </h1>

          <p
            style={{
              fontSize: 'clamp(16px, 2vw, 20px)',
              color: COLORS.gray400,
              maxWidth: 640,
              margin: '0 auto 40px',
              lineHeight: 1.6,
            }}
          >
            부정클릭이 광고비를 갉아먹고, 경쟁사는 자동으로 순위를 올립니다.
            <br />
            AdConcent가 24시간 지켜드립니다.
          </p>

          <Link
            to="/signup"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: '#2563EB',
              color: COLORS.white,
              padding: '16px 32px',
              borderRadius: 999,
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 0 60px rgba(37,99,235,0.35)',
            }}
          >
            무료로 시작하기 (신용카드 불필요)
            <ArrowRight style={{ width: 16, height: 16 }} />
          </Link>

          <p style={{ marginTop: 24, fontSize: 14, color: COLORS.gray500 }}>⚡ 3분 만에 설치</p>
        </div>
      </section>

      {/* Problem */}
      <section style={{ backgroundColor: COLORS.bgSlate, ...sectionPadding }}>
        <div style={containerStyle}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, color: COLORS.white, marginBottom: 16 }}>
              혹시 이런 경험 <span style={gradientText}>있으신가요?</span>
            </h2>
            <p style={{ color: COLORS.gray400, fontSize: 18 }}>
              네이버 광고를 운영하는 광고주 10명 중 8명이 이 문제를 겪고 있습니다
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 20,
            }}
          >
            {problems.map((p) => (
              <div key={p.title} style={{ ...cardStyle, padding: 32 }}>
                <div style={{ fontSize: 48, marginBottom: 20 }}>{p.emoji}</div>
                <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: COLORS.white, lineHeight: 1.4 }}>
                  "{p.title}"
                </h3>
                <p style={{ color: COLORS.gray400, fontSize: 14, lineHeight: 1.7 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Causes */}
      <section style={{ backgroundColor: COLORS.bgDark, ...sectionPadding }}>
        <div style={{ ...containerStyle, maxWidth: 960 }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, color: COLORS.white }}>
              당신의 광고비가 새는 <span style={gradientText}>3가지 구멍</span>
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {causes.map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.title}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 24,
                    alignItems: 'flex-start',
                    backgroundColor: COLORS.cardBg,
                    border: `1px solid ${c.border}`,
                    borderRadius: 16,
                    padding: 32,
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      flexShrink: 0,
                      borderRadius: 16,
                      backgroundColor: c.iconBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon style={{ width: 32, height: 32, color: c.iconColor }} />
                  </div>
                  <div style={{ flex: '1 1 300px' }}>
                    <h3 style={{ fontSize: 22, fontWeight: 600, color: COLORS.white, marginBottom: 12, lineHeight: 1.4 }}>
                      {c.title}
                    </h3>
                    <p style={{ color: COLORS.gray400, lineHeight: 1.7 }}>{c.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Solutions */}
      <section style={{ backgroundColor: COLORS.bgSlate, ...sectionPadding }}>
        <div style={containerStyle}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, color: COLORS.white }}>
              AdConcent가 <span style={gradientText}>이렇게 해결합니다</span>
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 20,
            }}
          >
            {solutions.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.title} style={{ ...cardStyle, padding: 32 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      backgroundColor: s.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 20,
                    }}
                  >
                    <Icon style={{ width: 28, height: 28, color: s.color }} />
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 600, color: COLORS.white, marginBottom: 20 }}>{s.title}</h3>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {s.items.map((item) => (
                      <li
                        key={item}
                        style={{ display: 'flex', gap: 8, fontSize: 14, color: COLORS.gray300, alignItems: 'flex-start' }}
                      >
                        <Check style={{ width: 16, height: 16, color: s.color, flexShrink: 0, marginTop: 2 }} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section style={{ backgroundColor: COLORS.bgDark, ...sectionPadding }}>
        <div style={containerStyle}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, color: COLORS.white }}>
              모든 업종에서 <span style={gradientText}>효과를 검증했습니다</span>
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 20,
            }}
          >
            {industries.map((i) => (
              <div key={i.name} style={{ ...cardStyle, padding: 28 }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>{i.emoji}</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: COLORS.white, marginBottom: 8 }}>{i.name}</h3>
                <p style={{ fontSize: 14, color: COLORS.gray400, lineHeight: 1.6 }}>{i.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section
        style={{
          background: 'linear-gradient(to right, #1E3A8A, #581C87)',
          padding: '80px 0',
        }}
      >
        <div style={containerStyle}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
            }}
          >
            {stats.map((s) => (
              <div
                key={s.label}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 16,
                  padding: 32,
                  textAlign: 'center',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <p style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, ...gradientText, marginBottom: 8 }}>
                  {s.value}
                </p>
                <p style={{ fontSize: 14, color: '#E0E7FF' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ backgroundColor: COLORS.bgSlate, ...sectionPadding }}>
        <div style={containerStyle}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, color: COLORS.white, marginBottom: 16 }}>
              명확한 <span style={gradientText}>요금제</span>
            </h2>
            <p style={{ color: COLORS.gray400, fontSize: 18 }}>무료로 시작해서 필요할 때 업그레이드하세요</p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 20,
            }}
          >
            {plans.map((plan) => {
              const isFree = plan.style === 'free';
              const isHighlight = plan.style === 'highlight';
              const cardBg = isHighlight
                ? 'linear-gradient(180deg, rgba(59,130,246,0.12), rgba(139,92,246,0.04))'
                : isFree
                ? 'linear-gradient(180deg, rgba(59,130,246,0.18), rgba(59,130,246,0.02))'
                : COLORS.cardBg;
              const cardBorder = isHighlight
                ? '2px solid rgba(59,130,246,0.55)'
                : isFree
                ? '2px solid rgba(96,165,250,0.45)'
                : `1px solid ${COLORS.cardBorder}`;
              const shadow = isHighlight ? '0 0 60px rgba(37,99,235,0.25)' : 'none';
              const checkColor = isHighlight ? '#60A5FA' : isFree ? '#93C5FD' : COLORS.gray500;
              const buttonBg = isHighlight || isFree ? '#2563EB' : 'rgba(255,255,255,0.05)';
              const buttonBorder = isHighlight || isFree ? 'none' : `1px solid ${COLORS.cardBorder}`;

              return (
                <div
                  key={plan.name}
                  style={{
                    position: 'relative',
                    background: cardBg,
                    border: cardBorder,
                    borderRadius: 16,
                    padding: 28,
                    boxShadow: shadow,
                  }}
                >
                  {plan.badge && (
                    <div
                      style={{
                        position: 'absolute',
                        top: -12,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span
                        style={{
                          color: COLORS.white,
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '4px 12px',
                          borderRadius: 999,
                          background: isFree ? '#3B82F6' : 'linear-gradient(to right, #3B82F6, #8B5CF6)',
                        }}
                      >
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 24, fontWeight: 700, color: COLORS.white, marginBottom: 4 }}>{plan.name}</h3>
                    <p style={{ fontSize: 14, color: COLORS.gray500, marginBottom: 20 }}>{plan.desc}</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 36, fontWeight: 800, color: COLORS.white }}>{plan.price}</span>
                      <span style={{ color: COLORS.gray500 }}>원/월</span>
                    </div>
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {plan.features.map((f, i) => (
                      <li
                        key={i}
                        style={{ display: 'flex', gap: 8, fontSize: 14, color: COLORS.gray300, alignItems: 'flex-start' }}
                      >
                        <Check style={{ width: 16, height: 16, color: checkColor, flexShrink: 0, marginTop: 2 }} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    to="/signup"
                    style={{
                      display: 'block',
                      textAlign: 'center',
                      width: '100%',
                      padding: '12px 0',
                      borderRadius: 12,
                      fontWeight: 600,
                      backgroundColor: buttonBg,
                      color: COLORS.white,
                      border: buttonBorder,
                      textDecoration: 'none',
                    }}
                  >
                    {plan.cta}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section
        style={{
          background: 'linear-gradient(to right, #2563EB, #9333EA)',
          padding: '96px 0',
          textAlign: 'center',
        }}
      >
        <div style={{ ...containerStyle, maxWidth: 720 }}>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, color: COLORS.white, marginBottom: 16 }}>
            지금 바로 시작하세요
          </h2>
          <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: '#DBEAFE', marginBottom: 40 }}>
            3분 설치 · 신용카드 불필요 · 언제든 업그레이드
          </p>

          <Link
            to="/signup"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: COLORS.white,
              color: '#1D4ED8',
              padding: '20px 40px',
              borderRadius: 999,
              fontSize: 18,
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
            }}
          >
            무료로 시작하기
            <ArrowRight style={{ width: 20, height: 20 }} />
          </Link>

          <p style={{ marginTop: 32, fontSize: 14, color: '#BFDBFE' }}>
            병원·쇼핑몰·부동산·음식점 광고주들이 매달 평균 23% 광고비를 절감하고 있습니다
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          backgroundColor: COLORS.bgFooter,
          borderTop: `1px solid ${COLORS.cardBorder}`,
          padding: '48px 0',
        }}
      >
        <div style={containerStyle}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <img src="/logo.svg" alt="A" width={28} height={28} style={{ width: 28, height: 28, borderRadius: 8 }} />
              <p style={{ fontSize: 18, fontWeight: 600, color: COLORS.white, margin: 0 }}>AdConcent</p>
            </div>
            <p style={{ fontSize: 14, color: COLORS.gray400, margin: 0 }}>AI 검색광고 자동화 플랫폼</p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              fontSize: 14,
              color: COLORS.gray500,
              marginBottom: 32,
            }}
          >
            <Link to="/terms" style={{ color: COLORS.gray500, textDecoration: 'none' }}>
              이용약관
            </Link>
            <span style={{ color: COLORS.gray600 }}>|</span>
            <Link to="/privacy" style={{ color: COLORS.gray500, textDecoration: 'none' }}>
              개인정보처리방침
            </Link>
          </div>

          <div
            style={{
              borderTop: `1px solid ${COLORS.cardBorder}`,
              paddingTop: 24,
              textAlign: 'center',
              fontSize: 12,
              color: COLORS.gray600,
              lineHeight: 1.7,
            }}
          >
            <p style={{ margin: '4px 0' }}>
              더블유부동산공인중개사사무소 | 대표 이광철 | 사업자등록번호 589-24-01721 | 통신판매업 제2025-인천부평-0992호
            </p>
            <p style={{ margin: '4px 0' }}>인천광역시 부평구 경원대로1344번길 34, 2층 256호 | 대표전화 1533-9077</p>
            <p style={{ marginTop: 8 }}>&copy; 2026 AdConcent. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
