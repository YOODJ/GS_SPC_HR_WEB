import { useState } from 'react';
import { normalizeResult } from '../bridge/nativeBridge';

type FcmTestPageProps = {
  onBack: () => void;
};

export function FcmTestPage({ onBack }: FcmTestPageProps) {
  const [fcmToken, setFcmToken] = useState('');
  const [firebaseProjectId, setFirebaseProjectId] = useState('spc-hr-dev');
  const [pushTitle, setPushTitle] = useState('출퇴근 안내 알림');
  const [pushBody, setPushBody] = useState('비콘 영역 내에 진입하여 출근 처리가 가능합니다.');
  const [pushClickAction, setPushClickAction] = useState('http://192.168.0.3:5173/#/file');
  const [running, setRunning] = useState<string | null>(null);
  const [popup, setPopup] = useState<{ title: string; result: unknown } | null>(null);
  const [fcmAccessToken, setFcmAccessToken] = useState('');

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

  const handleGetAccessToken = async () => {
    setRunning('getAccessToken');
    try {
      const response = await fetch('/api/get-access-token');
      const result = await response.json();
      if (result.success && result.accessToken) {
        setFcmAccessToken(result.accessToken);
      }
      setPopup({ title: 'Get Access Token Result', result });
    } catch (error: any) {
      setPopup({
        title: 'Get Access Token Result',
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
          projectId: firebaseProjectId,
          clickAction: pushClickAction
        })
      });
      
      const result = await response.json();
      if (result.success && result.accessToken) {
        setFcmAccessToken(result.accessToken);
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
            <label htmlFor="projectId">Firebase Project ID</label>
            <input 
              id="projectId" 
              value={firebaseProjectId} 
              onChange={(e) => setFirebaseProjectId(e.target.value)} 
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
