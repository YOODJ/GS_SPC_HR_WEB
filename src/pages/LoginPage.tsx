import { useState } from 'react';

type LoginPageProps = {
  onBack: () => void;
};

export function LoginPage({ onBack }: LoginPageProps) {
  const [id1, setId1] = useState('');
  const [pw1, setPw1] = useState('');
  const [id2, setId2] = useState('');
  const [pw2, setPw2] = useState('');

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SPC Hybrid WebView</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1>로그인 페이지 테스트</h1>
            <button className="secondary" onClick={onBack} style={{ minHeight: '32px', height: '32px', padding: '0 10px', fontSize: '14px' }}>
              Back
            </button>
          </div>
        </div>
      </header>

      <div className="content-grid" style={{ gridTemplateColumns: '1fr' }}>
        {/* Set 1: 14rem */}
        <section className="panel">
          <div className="panel-heading">
            <h2>로그인 세트 1 (Font Size: 14rem)</h2>
          </div>
          <div className="field">
            <label htmlFor="loginId1" style={{ fontSize: '16px', fontWeight: 'bold' }}>ID (14rem)</label>
            <input
              id="loginId1"
              type="text"
              value={id1}
              onChange={(e) => setId1(e.target.value)}
              style={{ fontSize: '14px', height: '42px', width: '100%', padding: '10px' }}
              placeholder="ID"
            />
          </div>
          <div className="field" style={{ marginTop: '20px' }}>
            <label htmlFor="loginPw1" style={{ fontSize: '16px', fontWeight: 'bold' }}>PASSWORD (14rem)</label>
            <input
              id="loginPw1"
              type="password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              style={{ fontSize: '14px', height: '42px', width: '100%', padding: '10px' }}
              placeholder="PW"
            />
          </div>
        </section>

        {/* Set 2: 16rem */}
        <section className="panel" style={{ marginTop: '20px' }}>
          <div className="panel-heading">
            <h2>로그인 세트 2 (Font Size: 16rem)</h2>
          </div>
          <div className="field">
            <label htmlFor="loginId2" style={{ fontSize: '16px', fontWeight: 'bold' }}>ID (16rem)</label>
            <input
              id="loginId2"
              type="text"
              value={id2}
              onChange={(e) => setId2(e.target.value)}
              style={{ fontSize: '16px', height: '52px', width: '100%', padding: '10px' }}
              placeholder="ID"
            />
          </div>
          <div className="field" style={{ marginTop: '20px' }}>
            <label htmlFor="loginPw2" style={{ fontSize: '16px', fontWeight: 'bold' }}>PASSWORD (16rem)</label>
            <input
              id="loginPw2"
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              style={{ fontSize: '16px', height: '52px', width: '100%', padding: '10px' }}
              placeholder="PW"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
