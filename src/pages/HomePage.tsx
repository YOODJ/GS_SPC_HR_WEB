type HomePageProps = {
  onNavigate: (path: string) => void;
};

export function HomePage({ onNavigate }: HomePageProps) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SPC Hybrid WebView</p>
          <h1>테스트 페이지</h1>
        </div>
      </header>

      <section className="menu-list" aria-label="테스트 목록">
        <button className="menu-item" onClick={() => onNavigate('/bridge')}>
          <span className="menu-index">1</span>
          <span>Bridge 테스트</span>
        </button>
        <button className="menu-item" onClick={() => onNavigate('/file')}>
          <span className="menu-index">2</span>
          <span>File 테스트</span>
        </button>
      </section>
    </main>
  );
}
