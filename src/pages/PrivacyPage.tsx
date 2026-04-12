import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function PrivacyPage() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">개인정보처리방침</h1>
        <p className="text-sm text-gray-500 mb-10">시행일: 2026년 4월 1일</p>

        <div className="space-y-8 text-gray-700">
          <section>
            <p className="leading-relaxed">
              더블유부동산(대표: 이광철, 이하 "회사")은 정보주체의 자유와 권리 보호를 위해
              「개인정보 보호법」 및 관계 법령이 정한 바를 준수하여, 적법하게 개인정보를
              처리하고 안전하게 관리하고 있습니다. 본 방침은 AdConcent 서비스(이하 "서비스") 이용에
              적용됩니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. 수집하는 개인정보 항목</h2>
            <table className="w-full border border-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left border-b border-gray-200">구분</th>
                  <th className="px-4 py-2 text-left border-b border-gray-200">수집 항목</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-2 border-b border-gray-100">필수</td>
                  <td className="px-4 py-2 border-b border-gray-100">이메일 주소, 비밀번호</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 border-b border-gray-100">결제 시</td>
                  <td className="px-4 py-2 border-b border-gray-100">결제 정보 (토스페이먼츠 대행)</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 border-b border-gray-100">서비스 이용 시</td>
                  <td className="px-4 py-2 border-b border-gray-100">네이버 광고 API 키, 광고 캠페인 데이터</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">자동 수집</td>
                  <td className="px-4 py-2">접속 IP, 브라우저 정보, 쿠키, 서비스 이용 기록</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. 개인정보의 수집 및 이용 목적</h2>
            <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
              <li>회원 가입 및 본인 확인, 회원 관리</li>
              <li>서비스 제공 및 운영 (부정클릭 차단, 자동 입찰, AI 분석)</li>
              <li>유료 구독 결제 처리 및 환불 처리</li>
              <li>공지사항, 약관 변경 등 필수적 안내사항 전달</li>
              <li>부정 이용 방지 및 비인가 사용 방지</li>
              <li>법령 및 약관 위반에 대한 대응</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. 개인정보의 보유 및 이용 기간</h2>
            <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
              <li>회원 정보: 회원 탈퇴 시까지</li>
              <li>결제 및 청구 기록: 「전자상거래법」에 따라 5년 보관</li>
              <li>접속 로그: 「통신비밀보호법」에 따라 3개월 보관</li>
              <li>회원 탈퇴 후 30일간 부정 이용 방지를 위해 이메일 보관</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. 개인정보의 제3자 제공</h2>
            <p className="leading-relaxed mb-2">
              회사는 정보주체의 개인정보를 본 방침의 「수집 및 이용 목적」에서 명시한 범위 내에서만
              처리하며, 정보주체의 동의 없이는 본래의 범위를 초과하여 처리하거나 제3자에게 제공하지
              않습니다. 단, 다음의 경우는 예외로 합니다.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
              <li>토스페이먼츠 (결제 처리 위탁)</li>
              <li>Cloudflare (서비스 인프라 제공)</li>
              <li>Supabase (데이터베이스 및 인증)</li>
              <li>Anthropic (AI 분석 처리, 익명화된 데이터만 전송)</li>
              <li>법령에 의해 요구되는 경우</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. 정보주체의 권리</h2>
            <p className="leading-relaxed">
              정보주체는 언제든지 등록되어 있는 자신의 개인정보를 조회하거나 수정할 수 있으며,
              가입 해지(동의 철회)를 요청할 수 있습니다. 본 권리 행사는 서비스 내 「설정」 메뉴
              또는 이메일(noble.kclee@gmail.com)을 통해 요청할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. 개인정보의 파기</h2>
            <p className="leading-relaxed">
              회사는 개인정보 보유 기간이 경과하거나 처리 목적이 달성된 경우, 지체 없이 해당
              개인정보를 파기합니다. 전자적 파일 형태의 정보는 복구 및 재생이 불가능한 방법으로
              영구 삭제하며, 종이 문서는 분쇄하거나 소각하여 파기합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. 개인정보 보호책임자</h2>
            <ul className="space-y-1 leading-relaxed">
              <li>책임자: 이광철 (대표)</li>
              <li>이메일: noble.kclee@gmail.com</li>
              <li>전화: 010-9298-8896</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. 개정 이력</h2>
            <p className="leading-relaxed">
              본 개인정보처리방침은 2026년 4월 1일부터 시행됩니다. 내용 변경 시 변경 사항을
              서비스 내 공지사항을 통해 사전 안내합니다.
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
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
