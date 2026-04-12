import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function PrivacyPage() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-6">개인정보처리방침</h1>

        <p className="text-gray-700 leading-relaxed mb-10">
          더블유부동산(이하 "회사")은 개인정보보호법에 따라 이용자의 개인정보를 보호하고 이와 관련한 고충을 신속하게 처리할 수 있도록 다음과 같이 개인정보처리방침을 수립·공개합니다.
        </p>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">제1조 (수집하는 개인정보 항목)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>필수: 이메일 주소, 비밀번호</li>
              <li>결제 시: 카드정보 (토스페이먼츠를 통해 처리, 회사는 저장하지 않음)</li>
              <li>서비스 이용 시: 광고 계정 ID, 클릭 로그 데이터</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">제2조 (개인정보 수집 목적)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>회원 가입 및 서비스 제공</li>
              <li>결제 처리 및 구독 관리</li>
              <li>서비스 개선 및 통계 분석</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">제3조 (개인정보 보유 및 이용기간)</h2>
            <p className="mb-2">회원 탈퇴 시까지 보유합니다. 단, 관계법령에 따라 일정 기간 보존이 필요한 경우 해당 기간 동안 보관합니다.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>전자상거래 관련 기록: 5년</li>
              <li>접속 로그: 3개월</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">제4조 (개인정보 제3자 제공)</h2>
            <p>회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 단, 결제 처리를 위해 토스페이먼츠에 최소한의 정보를 제공합니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">제5조 (개인정보보호 책임자)</h2>
            <ul className="space-y-1">
              <li>성명: 이광철</li>
              <li>이메일: noble.kclee@gmail.com</li>
              <li>전화: 010-9298-8896</li>
            </ul>
          </section>

          <section className="border-t border-gray-200 pt-6 mt-10 text-sm text-gray-500">
            <p>시행일: 2026년 4월 13일</p>
          </section>
        </div>
      </main>
    </div>
  );
}
