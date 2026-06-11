import { useState } from 'react';
import { normalizeResult } from '../bridge/nativeBridge';

type BridgeTestPageProps = {
  onBack: () => void;
};

export function BridgeTestPage({ onBack }: BridgeTestPageProps) {
  const [tokenInput, setTokenInput] = useState('sample-refresh-token');
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [popup, setPopup] = useState<{ title: string; result: unknown } | null>(null);

  const requestBiometricAuth = async () => {
    return new Promise((resolve) => {
      const timeoutId = window.setTimeout(() => {
        resolve({ success: false, code: 'callback_timeout', message: 'No biometric callback received.' });
      }, 30000);

      window.__spcBridgeAuthCallback = (payload) => {
        window.clearTimeout(timeoutId);
        resolve(normalizeResult(payload));
      };

      const immediate = window.SpcMobile!.requestBiometricAuth('__spcBridgeAuthCallback');
      Promise.resolve(immediate).then((value) => {
        const normalized = normalizeResult(value);
        if (
          normalized &&
          typeof normalized === 'object' &&
          'code' in normalized &&
          normalized.code !== 'prompt_started'
        ) {
          window.clearTimeout(timeoutId);
          resolve(normalized);
        }
      });
    });
  };

  const runAndShow = async (title: string, action: () => Promise<unknown> | unknown) => {
    setRunning(title);

    try {
      const result = normalizeResult(await action());
      setPopup({ title, result });
      return result;
    } catch (error) {
      setPopup({
        title,
        result: {
          success: false,
          code: 'test_page_error',
          message: error instanceof Error ? error.message : String(error),
        },
      });
      return null;
    } finally {
      setRunning(null);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SPC Hybrid WebView</p>
          <h1>Bridge Test Console</h1>
        </div>
        <div className="topbar-actions">
          <button className="secondary" onClick={onBack}>
            Back
          </button>
        </div>
      </header>

      <div className="content-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>getFcmToken</h2>
          </div>
          <button className="wide" onClick={() => runAndShow('getFcmToken', () => window.SpcMobile!.getFcmToken())}>
            getFcmToken
          </button>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Token</h2>
          </div>
          <div className="field">
            <label htmlFor="token">Refresh Token</label>
            <input id="token" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} />
          </div>
          <div className="button-grid">
            <button onClick={() => runAndShow('saveRefreshToken', () => window.SpcMobile!.saveRefreshToken(tokenInput))}>
              Save Token
            </button>
            <button onClick={() => runAndShow('getRefreshToken', () => window.SpcMobile!.getRefreshToken())}>
              Read Token
            </button>
            <button onClick={() => runAndShow('hasRefreshToken', () => window.SpcMobile!.hasRefreshToken())}>
              Token Exists
            </button>
            <button onClick={() => runAndShow('clearRefreshToken', () => window.SpcMobile!.clearRefreshToken())}>
              Clear Token
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Device</h2>
          </div>
          <div className="button-grid">
            <button onClick={() => runAndShow('getCurrentBeacon', () => window.SpcMobile!.getCurrentBeacon())}>
              Beacon
            </button>
            <button
              onClick={() => runAndShow('getBiometricAvailability', () => window.SpcMobile!.getBiometricAvailability())}
            >
              Bio State
            </button>
            <button onClick={() => runAndShow('requestBiometricAuth', requestBiometricAuth)}>Bio Auth</button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Biometric Login</h2>
          </div>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={biometricEnabled}
              onChange={(event) => setBiometricEnabled(event.target.checked)}
            />
            <span>{biometricEnabled ? 'Enabled' : 'Disabled'}</span>
          </label>
          <div className="button-grid two">
            <button
              onClick={() =>
                runAndShow('setBiometricLoginEnabled', () =>
                  window.SpcMobile!.setBiometricLoginEnabled(biometricEnabled),
                )
              }
            >
              Save Flag
            </button>
            <button
              onClick={() => runAndShow('isBiometricLoginEnabled', () => window.SpcMobile!.isBiometricLoginEnabled())}
            >
              Read Flag
            </button>
          </div>
        </section>
      </div>

      {running && <p className="running">Running: {running}</p>}

      {popup && (
        <div className="modal-backdrop" role="presentation">
          <section className="result-modal" role="dialog" aria-modal="true" aria-labelledby="result-title">
            <div className="panel-heading">
              <h2 id="result-title">{popup.title}</h2>
              <button className="secondary" onClick={() => setPopup(null)}>
                Close
              </button>
            </div>
            <pre>{JSON.stringify(popup.result, null, 2)}</pre>
          </section>
        </div>
      )}
    </main>
  );
}
