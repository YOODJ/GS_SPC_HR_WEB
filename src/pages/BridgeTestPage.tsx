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
  const [beaconDurationMs, setBeaconDurationMs] = useState('8000');
  const [permissionKeys, setPermissionKeys] = useState<{ [key: string]: boolean }>({
    location: true,
    bluetooth: true,
    camera: true,
    notification: true,
    gallery: true,
    storage: true,
  });
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [bottomTabMode, setBottomTabMode] = useState<number>(0);
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

  /**
   * 수집 스캔. 네이티브 응답을 가공 없이 그대로 보여준다.
   *
   * durationMs 를 넘기면 scanBeaconsWithDuration(스캔 창 지정)을, 넘기지 않으면
   * scanBeacons(5초 고정)를 호출한다. 둘 다 구버전 앱에는 없을 수 있어 존재 여부를 먼저 본다.
   */
  const scanBeaconList = (durationMs?: number) => {
    setBeaconLogs([]);

    const useDuration = durationMs !== undefined;

    if (useDuration && typeof window.SpcMobile?.scanBeaconsWithDuration !== 'function') {
      alert('이 앱 버전에는 scanBeaconsWithDuration 이 없습니다. 앱을 업데이트해주세요.');
      return;
    }
    if (!useDuration && typeof window.SpcMobile?.scanBeacons !== 'function') {
      alert('이 앱 버전에는 scanBeacons 가 없습니다. 앱을 업데이트해주세요.');
      return;
    }
    // NaN 이 브릿지로 넘어가면 네이티브에서 예측할 수 없게 동작한다.
    if (useDuration && (!Number.isFinite(durationMs) || durationMs! <= 0)) {
      alert('Scan Duration 은 0보다 큰 숫자여야 합니다.');
      return;
    }

    let formattedUuids = '';
    try {
      const parsed = JSON.parse(beaconUuidsJson);
      if (!Array.isArray(parsed)) {
        throw new Error('UUIDs must be a JSON array');
      }
      formattedUuids = JSON.stringify(parsed);
    } catch {
      alert('올바른 JSON 배열 형식으로 입력해주세요.');
      return;
    }

    const startedAt = Date.now();
    setRunning(useDuration ? 'scanBeaconsWithDuration' : 'scanBeacons');

    window.__spcBeaconScanCallback = (payload) => {
      delete window.__spcBeaconScanCallback;
      setRunning(null);

      const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
      setBeaconLogs((prev) => [...prev, `+${Date.now() - startedAt}ms payload: ${raw}`]);
    };

    if (useDuration) {
      // 네이티브가 1000~30000ms 로 clamp 한다. 실제 적용된 값은 콜백 도착 시각(+Nms)으로 확인.
      setBeaconLogs([`[Scan Started] durationMs=${durationMs}: ${formattedUuids}`]);
      window.SpcMobile!.scanBeaconsWithDuration!('window.__spcBeaconScanCallback', formattedUuids, durationMs!);
    } else {
      setBeaconLogs([`[Scan Started]: ${formattedUuids}`]);
      window.SpcMobile!.scanBeacons!('window.__spcBeaconScanCallback', formattedUuids);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1>Bridge Test Console</h1>
            <button className="secondary" onClick={onBack} style={{ minHeight: '32px', height: '32px', padding: '0 10px', fontSize: '14px' }}>
              Back
            </button>
          </div>
        </div>
      </header>

      <div className="content-grid">



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
            <h2>getDeviceInfo</h2>
          </div>
          <button className="wide" onClick={() => runAndShow('getDeviceInfo', () => window.SpcMobile!.getDeviceInfo())}>
            getDeviceInfo
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
          <div className="field">
            <label htmlFor="beaconDurationMs">Scan Duration (ms) — 네이티브에서 1000~30000 으로 clamp</label>
            <input
              id="beaconDurationMs"
              type="number"
              value={beaconDurationMs}
              onChange={(event) => setBeaconDurationMs(event.target.value)}
            />
          </div>
          <div className="button-grid two">
            <button onClick={() => startBeaconScan()}>Scan (첫 1개)</button>
            <button onClick={() => scanBeaconList()}>Scan (5초 수집)</button>
            <button onClick={() => scanBeaconList(Number(beaconDurationMs))}>
              Scan (시간 지정 수집)
            </button>
          </div>
          
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

        <section className="panel">
          <div className="panel-heading">
            <h2>Show Bottom Tab</h2>
          </div>
          <div className="field">
            <label htmlFor="bottomTabMode">Select Tab Mode</label>
            <select
              id="bottomTabMode"
              value={bottomTabMode}
              onChange={(e) => setBottomTabMode(Number(e.target.value))}
            >
              <option value={0}>0 : Hide</option>
              <option value={1}>1 : Show (사무직)</option>
              <option value={2}>2 : Show (노무직)</option>
            </select>
          </div>
          <button 
            className="wide" 
            onClick={() => {
              try {
                console.log("[Web] Calling showBottomTab with mode:", bottomTabMode);
                window.SpcMobile?.showBottomTab(bottomTabMode);
              } catch (e) {
                console.error("showBottomTab 호출 실패:", e);
                alert("호출 실패: " + String(e));
              }
            }}
          >
            Send Tab Request
          </button>
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
