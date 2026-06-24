import { useState } from 'react';
import { normalizeResult } from '../bridge/nativeBridge';

type BridgeTestPageProps = {
  onBack: () => void;
};

export function BridgeTestPage({ onBack }: BridgeTestPageProps) {
  const [tokenInput, setTokenInput] = useState('sample-refresh-token');
  const [beaconUuidsJson, setBeaconUuidsJson] = useState(
    JSON.stringify(
      [
        '74278BDA-B644-4520-8F0C-720EAF059935',
        'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0',
        'F7CE4A5C-370F-BB91-ED58-A44FA7EBBBCC'
      ],
      null,
      2
    )
  );
  const [beaconLogs, setBeaconLogs] = useState<string[]>([]);
  const [permissionKeys, setPermissionKeys] = useState<{ [key: string]: boolean }>({
    location: true,
    bluetooth: true,
    camera: true,
    notification: true,
    gallery: true,
    storage: true,
  });
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

  const startBeaconScan = async () => {
    setBeaconLogs([]); // 기존 로그 초기화
    
    // 연속 호출을 처리하기 위해 콜백 함수 재정의
    window.myBeaconCallback = (payload) => {
      console.log("payload", payload);
      const msg = typeof payload === 'string' ? payload : JSON.stringify(payload);
      setBeaconLogs((prev) => [...prev, `payload: ${msg}`]);
    };

    try {
      setRunning('scanBeacon');

      // 입력한 JSON 유효성 검사 및 직렬화
      let formattedUuids = '';
      try {
        const parsed = JSON.parse(beaconUuidsJson);
        if (!Array.isArray(parsed)) {
          throw new Error('UUIDs must be a JSON array');
        }
        formattedUuids = JSON.stringify(parsed);
      } catch (err) {
        alert('올바른 JSON 배열 형식으로 입력해주세요.');
        return;
      }

      console.log("[Web] Calling getCurrentBeacon with:", formattedUuids);
      const immediate = window.SpcMobile!.getCurrentBeacon('window.myBeaconCallback', formattedUuids);
      const result = normalizeResult(await Promise.resolve(immediate));
      
      // 시작 결과도 로그에 남김
      setBeaconLogs((prev) => [...prev, `[Scan Started]: ${JSON.stringify(result)}`]);
    } catch (error) {
      setBeaconLogs((prev) => [...prev, `[Error]: ${error instanceof Error ? error.message : String(error)}`]);
    } finally {
      setRunning(null);
    }
  };

  const checkPermissions = async () => {
    const selectedKeys = Object.keys(permissionKeys).filter((key) => permissionKeys[key]);
    if (selectedKeys.length === 0) {
      alert("선택된 권한 키가 없습니다.");
      return;
    }
    
    return new Promise((resolve) => {
      const timeoutId = window.setTimeout(() => {
        resolve({ success: false, code: 'callback_timeout', message: 'No permissions callback received.' });
      }, 10000);

      window.__spcBridgePermissionCallback = (payload) => {
        window.clearTimeout(timeoutId);
        resolve(normalizeResult(payload));
      };

      try {
        console.log("[Web] Calling hasPermissions with keys:", selectedKeys);
        window.SpcMobile!.hasPermissions('__spcBridgePermissionCallback', JSON.stringify(selectedKeys));
      } catch (err) {
        window.clearTimeout(timeoutId);
        resolve({ success: false, message: err instanceof Error ? err.message : String(err) });
      }
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
            <h2>Callback Test</h2>
          </div>
          <div className="button-grid two">
            <button onClick={() => {
              window.myTestCallback = (payload) => {
                console.log("[Web] myTestCallback called with:", payload);
                try {
                  const msg = typeof payload === 'string' ? payload : JSON.stringify(payload);
                  alert("Callback Received: " + msg);
                } catch (e) {
                  alert("Callback Received but failed to parse: " + String(payload));
                }
              };
              console.log("[Web] Calling native testCallback...");
              window.SpcMobile?.testCallback?.('window.myTestCallback');
            }}>
              Test Native
            </button>
            <button className="secondary" onClick={() => {
              console.log("[Web] Simulating evaluateJavascript...");
              // 네이티브에서 evaluateJavascript를 호출하는 것과 동일한 효과
              window.eval("window.myTestCallback && window.myTestCallback('Simulation Success')");
            }}>
              Simulate Eval
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Check Permissions</h2>
          </div>
          <div className="permission-checkbox-group">
            {Object.keys(permissionKeys).map((key) => (
              <label 
                key={key} 
                className={`permission-checkbox-label ${permissionKeys[key] ? 'checked' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={permissionKeys[key]}
                  onChange={(event) => setPermissionKeys((prev) => ({ ...prev, [key]: event.target.checked }))}
                />
                <span>{key}</span>
              </label>
            ))}
          </div>
          <button className="wide" onClick={() => runAndShow('hasPermissions', checkPermissions)}>
            Check Permissions
          </button>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>App Settings</h2>
          </div>
          <button className="wide" onClick={() => {
            try {
              console.log("[Web] Calling openAppSettings...");
              window.SpcMobile?.openAppSettings();
            } catch (e) {
              console.error("openAppSettings 호출 실패:", e);
            }
          }}>
            Open Settings
          </button>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>getDeviceToken</h2>
          </div>
          <button className="wide" onClick={() => runAndShow('getDeviceToken', () => window.SpcMobile!.getDeviceToken())}>
            getDeviceToken
          </button>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Beacon Scan</h2>
          </div>
          <div className="field">
            <label htmlFor="beaconUuidsJson">Target UUIDs (JSON Array)</label>
            <textarea
              id="beaconUuidsJson"
              value={beaconUuidsJson}
              onChange={(event) => setBeaconUuidsJson(event.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
            />
          </div>
          <button className="wide" onClick={startBeaconScan}>
            Scan
          </button>
          
          {beaconLogs.length > 0 && (
            <div style={{ marginTop: '1rem', maxHeight: '200px', overflowY: 'auto', background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem', color: '#333' }}>
              {beaconLogs.map((log, i) => (
                <div key={i} style={{ marginBottom: '0.25rem', borderBottom: '1px solid #ddd', paddingBottom: '0.25rem', wordBreak: 'break-all' }}>
                  {log}
                </div>
              ))}
            </div>
          )}
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
