type FileTestPageProps = {
  onBack: () => void;
};

export function FileTestPage({ onBack }: FileTestPageProps) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SPC Hybrid WebView</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1>File 테스트</h1>
            <button className="secondary" onClick={onBack} style={{ minHeight: '32px', height: '32px', padding: '0 10px', fontSize: '14px' }}>
              Back
            </button>
          </div>
        </div>
      </header>

      <section className="panel">
        <div className="panel-heading">
          <h2>File Test</h2>
        </div>
        <p className="empty">파일 테스트 항목을 추가할 독립 페이지입니다.</p>
      </section>
    </main>
  );
}
