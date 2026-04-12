import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold text-blue-600">AdConcent</Link>
          <Link to="/" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4" />홈으로
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">이용약관</h1>
        <p className="text-sm text-gray-500 mb-10">시행일: 2026년 4월 1일</p>

        <div className="prose prose-sm max-w-none space-y-8 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제1조 (목적)</h2>
            <p className="leading-relaxed">
              본 약관은 더블유부동산(이하 "회사")이 운영하는 AdConcent 서비스(이하 "서비스")의
              이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항, 기타 필요한 사항을
              규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제2조 (정의)</h2>
            <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed">
              <li>"서비스"란 회사가 제공하는 검색광고 부정클릭 차단, 자동 입찰 최적화, AI 광고 분석 등 일체의 SaaS 서비스를 말합니다.</li>
              <li>"회원"이란 회사와 서비스 이용계약을 체결한 자를 말합니다.</li>
              <li>"유료 서비스"란 회사가 유료로 제공하는 Starter, Growth, Pro 등 모든 구독 플랜을 의미합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제3조 (서비스 이용)</h2>
            <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed">
              <li>회원은 회사가 정한 절차에 따라 서비스를 이용할 수 있습니다.</li>
              <li>회사는 안정적인 서비스 제공을 위해 시스템 점검, 보수, 교체를 진행할 수 있으며, 이로 인해 일시적으로 서비스가 중단될 수 있습니다.</li>
              <li>회원은 서비스를 이용함에 있어 관계 법령, 본 약관 및 회사가 안내하는 사항을 준수해야 합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제4조 (요금 및 결제)</h2>
            <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed">
              <li>유료 서비스의 요금 및 결제 방식은 서비스 화면에 게시하는 바에 따릅니다.</li>
              <li>구독은 매월 자동 결제되며, 회원은 언제든지 다음 결제일 전에 구독을 해지할 수 있습니다.</li>
              <li>결제는 토스페이먼츠를 통해 안전하게 처리되며, 회사는 결제 정보를 직접 보관하지 않습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제5조 (환불 정책)</h2>
            <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed">
              <li>회원이 구독을 해지하더라도 이미 결제된 해당 월의 잔여 기간 동안 서비스를 계속 이용할 수 있습니다.</li>
              <li>이미 결제 완료된 구독료는 원칙적으로 환불되지 않습니다. 단, 서비스 장애가 회사의 귀책사유로 24시간 이상 지속된 경우 일할 계산하여 환불할 수 있습니다.</li>
              <li>결제 후 7일 이내에 서비스를 일체 사용하지 않은 경우 전액 환불이 가능합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제6조 (회원의 의무)</h2>
            <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed">
              <li>회원은 서비스를 부정한 용도(스팸, 어뷰징, 자동화 어뷰즈 등)로 사용해서는 안 됩니다.</li>
              <li>회원은 자신의 계정 정보를 안전하게 관리할 책임이 있으며, 계정의 도용으로 인한 손해에 대해 회사는 책임을 지지 않습니다.</li>
              <li>회원은 타인의 네이버 광고 계정 정보를 무단으로 등록해서는 안 됩니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제7조 (면책조항)</h2>
            <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed">
              <li>회사는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력적 사유로 인한 서비스 장애에 대해 책임을 지지 않습니다.</li>
              <li>회사는 AI 분석 결과 및 자동 입찰 추천이 광고 성과를 보장하지 않으며, 회원의 의사결정에 따른 결과에 대해 책임을 지지 않습니다.</li>
              <li>회사는 외부 광고 플랫폼(네이버, 구글, Meta 등)의 정책 변경으로 인한 서비스 영향에 대해 책임을 지지 않습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제8조 (약관 변경)</h2>
            <p className="leading-relaxed">
              회사는 필요한 경우 본 약관을 변경할 수 있으며, 변경된 약관은 서비스 화면에 공지한
              날로부터 7일 후 효력이 발생합니다. 회원이 변경된 약관에 동의하지 않을 경우 서비스
              이용을 중단하고 탈퇴할 수 있습니다.
            </p>
          </section>

          <section className="border-t border-gray-200 pt-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">사업자 정보</h2>
            <ul className="space-y-1 text-sm">
              <li>상호명: 더블유부동산</li>
              <li>대표자: 이광철</li>
              <li>사업자등록번호: 589-24-01721</li>
              <li>통신판매업 신고번호: 제2025-인천부평-0992호</li>
              <li>주소: 인천광역시 연수구 먼우금로222번길 37 (연수동)</li>
              <li>연락처: 010-9298-8896 / noble.kclee@gmail.com</li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
