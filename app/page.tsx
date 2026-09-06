export default function HomePage() {
  /*
   * 1차 Next.js 전환 방식:
   * 현재 승인된 HTML 디자인/만세력 엔진을 그대로 보존하기 위해
   * public/saju.html을 루트 화면에서 표시합니다.
   *
   * 다음 단계에서 로그인/결제/MY REPORT를 붙이면서
   * 섹션별로 React 컴포넌트로 교체할 수 있습니다.
   */
  return (
    <main>
      <iframe
        className="site-frame"
        src="/saju.html"
        title="나의사주"
      />
    </main>
  );
}
