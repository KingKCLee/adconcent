import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="max-w-[800px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-blue-600">AdConcent</Link>
          <Link to="/" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4" />홈으로
          </Link>
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-10">AdConcent 이용약관</h1>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">제1조 (목적)</h2>
            <p>본 약관은 더블유부동산(이하 "회사")이 운영하는 AdConcent 서비스(이하 "서비스")의 이용에 관한 조건 및 절차를 규정함을 목적으로 합니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">제2조 (서비스 내용)</h2>
            <p>회사는 네이버 검색광고 자동화, 부정클릭 방지, AI 광고 분석 등의 SaaS 서비스를 제공합니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">제3조 (이용요금)</h2>
            <ul className="list-disc pl-5 space-y-1 mb-2">
              <li>Free 플랜: 무료</li>
              <li>Starter 플랜: 월 9,900원</li>
              <li>Growth 플랜: 월 24,900원</li>
              <li>Pro 플랜: 월 49,900원</li>
            </ul>
            <p>요금은 매월 자동 결제됩니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">제4조 (환불 정책)</h2>
            <p>구독 취소 시 당월 말까지 서비스를 이용할 수 있으며, 이미 결제된 금액은 환불되지 않습니다. 단, 서비스 장애로 인한 경우 회사 정책에 따라 환불이 가능합니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">제5조 (서비스 중단)</h2>
            <p>회사는 시스템 점검, 장애 등의 사유로 서비스를 일시 중단할 수 있으며, 사전 공지를 원칙으로 합니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">제6조 (면책조항)</h2>
            <p>회사는 천재지변, 네이버 API 정책 변경 등 불가항력적 사유로 인한 서비스 장애에 대해 책임을 지지 않습니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">제7조 (준거법)</h2>
            <p>본 약관은 대한민국 법률에 따라 해석됩니다.</p>
          </section>

          <section className="border-t border-gray-200 pt-6 mt-10 text-sm text-gray-500">
            <p>시행일: 2026년 4월 13일</p>
            <p className="mt-1">사업자: 더블유부동산 | 대표: 이광철 | 사업자등록번호: 589-24-01721</p>
          </section>
        </div>
      </main>
    </div>
  );
}
