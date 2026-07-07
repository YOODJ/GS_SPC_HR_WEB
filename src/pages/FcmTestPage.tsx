import { useState, useEffect } from 'react';
import { normalizeResult } from '../bridge/nativeBridge';

type FcmTestPageProps = {
  onBack: () => void;
};

export function FcmTestPage({ onBack }: FcmTestPageProps) {
  const [fcmToken, setFcmToken] = useState('');
  const [targetEnv, setTargetEnv] = useState<'dev' | 'prod'>('dev');
  const [firebaseProjectId, setFirebaseProjectId] = useState('조회 중...');
  const [pushTitle, setPushTitle] = useState('출퇴근 안내 알림');
  const [pushBody, setPushBody] = useState('비콘 영역 내에 진입하여 출근 처리가 가능합니다.');
  const [pushClickAction, setPushClickAction] = useState('/file');
  const [running, setRunning] = useState<string | null>(null);
  const [popup, setPopup] = useState<{ title: string; result: unknown } | null>(null);
  const [fcmAccessToken, setFcmAccessToken] = useState('');

  // targetEnv가 바뀔 때마다 실시간으로 백엔드의 credentials 파일에서 project_id를 파싱하여 동기화합니다.
  useEffect(() => {
    let active = true;
    const fetchProjectInfo = async () => {
      setFirebaseProjectId('조회 중...');
      try {
        const response = await fetch(`/api/get-project-info?env=${targetEnv}`);
        const result = await response.json();
        if (active) {
          if (result.success && result.projectId) {
            setFirebaseProjectId(result.projectId);
          } else {
            setFirebaseProjectId(`(설정 파일 없음: ${targetEnv})`);
          }
        }
      } catch (err) {
        if (active) {
          setFirebaseProjectId(`(조회 실패: ${targetEnv})`);
        }
      }
    };

    fetchProjectInfo();
    return () => {
      active = false;
    };
  }, [targetEnv]);

  const handleGetDeviceInfo = async () => {
    try {
      setRunning('getDeviceInfo');
      const raw = window.SpcMobile!.getDeviceInfo();
      const result = normalizeResult(await Promise.resolve(raw));
      
      setPopup({ title: 'getDeviceInfo', result });
      
      if (result && typeof result === 'object' && 'success' in result && result.success) {
        if ('fcmToken' in result && typeof result.fcmToken === 'string') {
          setFcmToken(result.fcmToken);
        }
      }
      return result;
    } catch (error: any) {
      setPopup({
        title: 'getDeviceInfo',
        result: { success: false, code: 'error', message: error.message || String(error) }
      });
    } finally {
      setRunning(null);
    }
  };

  const handleEnvChange = (env: 'dev' | 'prod') => {
    setTargetEnv(env);
  };

  const handleGetAccessToken = async () => {
    setRunning('getAccessToken');
    try {
      const response = await fetch(`/api/get-access-token?env=${targetEnv}`);
      const result = await response.json();
      if (result.success) {
        if (result.accessToken) {
          setFcmAccessToken(result.accessToken);
        }
        if (result.projectId) {
          setFirebaseProjectId(result.projectId);
        }
      }
      setPopup({ title: `Get Access Token Result (${targetEnv.toUpperCase()})`, result });
    } catch (error: any) {
      setPopup({
        title: `Get Access Token Result (${targetEnv.toUpperCase()})`,
        result: { success: false, code: 'error', message: error.message || String(error) }
      });
    } finally {
      setRunning(null);
    }
  };

  const handleSendPush = async () => {
    if (!fcmToken) {
      alert('먼저 getDeviceInfo를 호출하여 기기 토큰을 획득해주세요.');
      return;
    }
    
    setRunning('sendPush');
    try {
      const response = await fetch('/api/send-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: fcmToken,
          title: pushTitle,
          body: pushBody,
          clickAction: pushClickAction,
          env: targetEnv
        })
      });
      
      const result = await response.json();
      if (result.success) {
        if (result.accessToken) {
          setFcmAccessToken(result.accessToken);
        }
        if (result.projectId) {
          setFirebaseProjectId(result.projectId);
        }
      }
      setPopup({ title: 'Send Push Result', result });
    } catch (error: any) {
      setPopup({
        title: 'Send Push Result',
        result: { success: false, code: 'send_failed', message: error.message || String(error) }
      });
    } finally {
      setRunning(null);
    }
  };

  const handleCopy = (text: string, label: string) => {
    if (!text) {
      alert('복사할 토큰이 없습니다.');
      return;
    }
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => alert(`${label}이 클립보드에 복사되었습니다.`))
        .catch(() => fallbackCopy(text, label));
    } else {
      fallbackCopy(text, label);
    }
  };

  const fallbackCopy = (text: string, label: string) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (successful) {
        alert(`${label}이 클립보드에 복사되었습니다.`);
      } else {
        alert('복사에 실패했습니다. 수동으로 복사해주세요.');
      }
    } catch (err) {
      alert('복사에 실패했습니다. 수동으로 복사해주세요.');
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SPC Hybrid WebView</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1>FCM Test Console</h1>
            <button className="secondary" onClick={onBack} style={{ minHeight: '32px', height: '32px', padding: '0 10px', fontSize: '14px' }}>
              Back
            </button>
          </div>
        </div>
      </header>

      <div className="content-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Target Environment</h2>
          </div>
          <div className="field">
            <label htmlFor="targetEnv">Select Environment</label>
            <select
              id="targetEnv"
              value={targetEnv}
              onChange={(e) => handleEnvChange(e.target.value as 'dev' | 'prod')}
              style={{
                width: '100%',
                height: '40px',
                padding: '0 8px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                color: '#1e293b',
                fontSize: '14px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="dev">Development (Dev)</option>
              <option value="prod">Production (Prod)</option>
            </select>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>getDeviceInfo</h2>
          </div>
          <button className="wide" onClick={handleGetDeviceInfo}>
            getDeviceInfo
          </button>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>FCM Access Token</h2>
          </div>
          <div className="field">
            <label htmlFor="accessToken">OAuth2 Access Token</label>
            <div className="input-group">
              <input 
                id="accessToken" 
                value={fcmAccessToken} 
                onChange={(e) => setFcmAccessToken(e.target.value)} 
                placeholder="먼저 Get Token을 실행하거나 푸시를 발송하세요"
              />
              <button 
                type="button" 
                className="secondary"
                onClick={() => handleCopy(fcmAccessToken, 'Access Token')}
              >
                Copy
              </button>
            </div>
          </div>
          <button className="wide" onClick={handleGetAccessToken}>
            Get Access Token
          </button>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>FCM Push Test (Local Only)</h2>
          </div>
          <div className="field">
            <label htmlFor="fcmToken">FCM Device Token</label>
            <div className="input-group">
              <input 
                id="fcmToken" 
                value={fcmToken} 
                onChange={(e) => setFcmToken(e.target.value)} 
                placeholder="먼저 getDeviceInfo를 실행하세요"
              />
              <button 
                type="button" 
                className="secondary"
                onClick={() => handleCopy(fcmToken, 'FCM Device Token')}
              >
                Copy
              </button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="projectId">Firebase Project ID (Read-only)</label>
            <input 
              id="projectId" 
              value={firebaseProjectId} 
              readOnly
              style={{ backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }}
              placeholder="Get Access Token 호출 시 자동 추출됩니다."
            />
          </div>
          <div className="field">
            <label htmlFor="pushTitle">Push Title</label>
            <input 
              id="pushTitle" 
              value={pushTitle} 
              onChange={(e) => setPushTitle(e.target.value)} 
            />
          </div>
          <div className="field">
            <label htmlFor="pushBody">Push Body</label>
            <input 
              id="pushBody" 
              value={pushBody} 
              onChange={(e) => setPushBody(e.target.value)} 
            />
          </div>
          <div className="field">
            <label htmlFor="clickAction">Click Action URL (Deep Link)</label>
            <input 
              id="clickAction" 
              value={pushClickAction} 
              onChange={(e) => setPushClickAction(e.target.value)} 
              placeholder="예: /file (http 미만은 ?APP_LINK=/file 로 변환됨)"
            />
          </div>
          <button className="wide" onClick={handleSendPush} style={{ marginTop: '8px' }}>
            Send Push Notification
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
