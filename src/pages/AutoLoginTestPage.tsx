import { useCallback, useEffect, useState } from 'react';
import { normalizeResult } from '../bridge/nativeBridge';
import type { AutoLoginState, DeviceAuthResult } from '../bridge/nativeBridge';

type AutoLoginTestPageProps = {
  onBack: () => void;
};

const CALLBACK_TIMEOUT_MS = 60000;

/**
 * 네이티브 콜백은 플랫폼마다 페이로드 형태가 다르다.
 *   Android: callbackName({"success":true,...})    → 객체
 *   iOS:     callbackName('{"success":true,...}')  → 문자열
 * normalizeResult 가 둘 다 흡수한다.
 */
function toDeviceAuthResult(payload: unknown): DeviceAuthResult {
  const normalized = normalizeResult(payload);

  if (normalized && typeof normalized === 'object') {
    const value = normalized as Partial<DeviceAuthResult>;
    return {
      success: Boolean(value.success),
      reason: (value.reason ?? 'failed') as DeviceAuthResult['reason'],
      message: value.message ?? '',
      userId: value.userId ?? '',
    };
  }

  return { success: false, reason: 'failed', message: String(normalized), userId: '' };
}

export function AutoLoginTestPage({ onBack }: AutoLoginTestPageProps) {
  const [userId, setUserId] = useState('hong123');
  const [state, setState] = useState<AutoLoginState | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [popup, setPopup] = useState<{ title: string; result: unknown } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const appendLog = useCallback((line: string) => {
    const stamp = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    setLogs((prev) => [...prev, `[${stamp}] ${line}`]);
  }, []);

  const bridgeMissing = typeof window === 'undefined' || !window.SpcMobile;

  /** 현재 저장 상태 + 기기 인증 가용성 조회 */
  const refreshState = useCallback(async (): Promise<AutoLoginState | null> => {
    if (!window.SpcMobile?.getAutoLoginState) {
      setStateError('SpcMobile.getAutoLoginState 를 찾을 수 없습니다. 앱 웹뷰에서 열어주세요.');
      setState(null);
      return null;
    }

    try {
      const raw = normalizeResult(await Promise.resolve(window.SpcMobile.getAutoLoginState()));
      const next = raw as AutoLoginState;
      setState(next);
      setStateError(null);
      return next;
    } catch (error) {
      setStateError(error instanceof Error ? error.message : String(error));
      setState(null);
      return null;
    }
  }, []);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  /** 비동기 브릿지 호출을 Promise 로 감싼다. 응답이 없으면 타임아웃으로 끊는다. */
  const callWithCallback = useCallback(
    (
      callbackKey: '__spcAutoLoginEnableCallback' | '__spcAutoLoginAuthCallback',
      invoke: (callbackName: string) => void,
    ): Promise<DeviceAuthResult> =>
      new Promise((resolve) => {
        let settled = false;

        const finish = (result: DeviceAuthResult) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);
          delete window[callbackKey];
          resolve(result);
        };

        // 프롬프트가 아예 뜨지 않는 경우 화면이 영영 멈추지 않도록 가드를 둔다.
        const timeoutId = window.setTimeout(() => {
          finish({
            success: false,
            reason: 'failed',
            message: `콜백 미수신 (${CALLBACK_TIMEOUT_MS / 1000}초 초과)`,
          });
        }, CALLBACK_TIMEOUT_MS);

        window[callbackKey] = (payload) => finish(toDeviceAuthResult(payload));

        try {
          invoke(callbackKey);
        } catch (error) {
          finish({
            success: false,
            reason: 'unavailable',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    [],
  );

  const enableAutoLogin = useCallback(
    (id: string) =>
      callWithCallback('__spcAutoLoginEnableCallback', (callbackName) => {
        window.SpcMobile!.enableAutoLogin(callbackName, id);
      }),
    [callWithCallback],
  );

  const requestAutoLoginAuth = useCallback(
    () =>
      callWithCallback('__spcAutoLoginAuthCallback', (callbackName) => {
        window.SpcMobile!.requestAutoLoginAuth(callbackName);
      }),
    [callWithCallback],
  );

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
      void refreshState();
    }
  };

  /** 로그인 페이지 진입 시 웹이 실제로 수행할 판단을 그대로 재현한다. */
  const simulateLoginPageEntry = async () => {
    setLogs([]);
    setRunning('로그인 페이지 진입 시뮬레이션');

    try {
      appendLog('getAutoLoginState() 호출');
      const current = await refreshState();

      if (!current) {
        appendLog('상태 조회 실패 → 로그인 폼 표시');
        return;
      }

      appendLog(
        `hasUserId=${current.hasUserId}, deviceAuth.available=${current.deviceAuth.available}, type=${current.deviceAuth.type}`,
      );

      if (!current.hasUserId) {
        appendLog('저장된 아이디 없음 → 로그인 폼 표시 (아이디/비밀번호 입력)');
        return;
      }

      if (!current.deviceAuth.available) {
        appendLog('기기 인증 불가 → 로그인 폼 표시 (저장된 아이디는 유지)');
        return;
      }

      appendLog(`자동로그인 시도: requestAutoLoginAuth() 호출 (userId=${current.userId})`);
      const result = await requestAutoLoginAuth();
      appendLog(`결과: success=${result.success}, reason=${result.reason}, userId=${result.userId ?? ''}`);

      if (result.success) {
        appendLog(`→ 서버에 자동로그인 요청(userId=${result.userId ?? ''}) 후 메인 화면 진입 (여기서는 표시만)`);
      } else if (result.reason === 'lockout') {
        appendLog('→ 시도 초과로 잠김. 안내 후 로그인 폼 표시 (저장된 아이디는 유지)');
      } else {
        appendLog('→ 로그인 폼 표시 (저장된 아이디는 유지)');
      }
    } finally {
      setRunning(null);
    }
  };

  /** 수동 로그인 성공 직후 웹이 호출할 흐름을 재현한다. */
  const simulateLoginSuccess = async () => {
    setLogs([]);
    setRunning('로그인 성공 시뮬레이션');

    try {
      if (!userId.trim()) {
        appendLog('아이디가 비어 있습니다.');
        return;
      }

      appendLog(`로그인 성공 가정 (userId=${userId})`);
      appendLog('enableAutoLogin() 호출 → 기기 인증 프롬프트');

      const result = await enableAutoLogin(userId.trim());
      appendLog(`결과: success=${result.success}, reason=${result.reason}, userId=${result.userId ?? ''}`);

      if (result.success) {
        appendLog(`→ 자동로그인 활성화됨. 아이디(${result.userId ?? ''})가 저장되었습니다.`);
      } else {
        appendLog('→ 활성화 취소/실패. 아이디는 저장되지 않습니다.');
      }

      const after = await refreshState();
      appendLog(`저장 확인: hasUserId=${after?.hasUserId ?? 'unknown'}`);
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
            <h1>Auto Login Test</h1>
            <button
              className="secondary"
              onClick={onBack}
              style={{ minHeight: '32px', height: '32px', padding: '0 10px', fontSize: '14px' }}
            >
              Back
            </button>
          </div>
        </div>
      </header>

      <div className="content-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>현재 상태</h2>
            <button className="secondary" onClick={() => void refreshState()}>
              새로고침
            </button>
          </div>

          {bridgeMissing && (
            <p style={{ color: '#c0392b' }}>
              SpcMobile 브릿지가 없습니다. 일반 브라우저가 아니라 <strong>앱 웹뷰</strong>에서 열어주세요.
            </p>
          )}
          {stateError && <p style={{ color: '#c0392b' }}>{stateError}</p>}

          {state && (
            <pre>
              {[
                `저장된 아이디 : ${state.hasUserId ? state.userId : '(없음)'}`,
                `기기 인증     : ${state.deviceAuth.available ? '사용 가능' : '사용 불가'}`,
                `인증 수단     : ${state.deviceAuth.type}`,
              ].join('\n')}
            </pre>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>시나리오 재현</h2>
          </div>
          <div className="field">
            <label htmlFor="auto-login-user-id">사용자 아이디</label>
            <input
              id="auto-login-user-id"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="hong123"
            />
          </div>
          <button className="wide" onClick={() => void simulateLoginPageEntry()}>
            ① 로그인 페이지 진입 시뮬레이션
          </button>
          <button className="wide" onClick={() => void simulateLoginSuccess()}>
            ② 로그인 성공 → 자동로그인 활성화
          </button>

          {logs.length > 0 && (
            <pre style={{ marginTop: '12px' }}>{logs.join('\n')}</pre>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>개별 브릿지 호출</h2>
          </div>
          <div className="button-grid">
            <button onClick={() => void runAndShow('getAutoLoginState', () => window.SpcMobile!.getAutoLoginState())}>
              getAutoLoginState
            </button>
            <button onClick={() => void runAndShow('disableAutoLogin', () => window.SpcMobile!.disableAutoLogin())}>
              disableAutoLogin
            </button>
            <button onClick={() => void runAndShow('enableAutoLogin', () => enableAutoLogin(userId.trim()))}>
              enableAutoLogin
            </button>
            <button onClick={() => void runAndShow('requestAutoLoginAuth', () => requestAutoLoginAuth())}>
              requestAutoLoginAuth
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>확인할 항목</h2>
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.9 }}>
            <li>아이디 미저장 상태로 ① 실행 → 로그인 폼 분기</li>
            <li>② 에서 인증 취소 → 저장 안 됨 (현재 상태로 확인)</li>
            <li>지문 등록 기기 / PIN·패턴만 등록 기기 / 화면잠금 없는 기기</li>
            <li>연속 실패 후 <code>lockout</code> 응답</li>
            <li>disableAutoLogin 후 hasUserId=false 로 초기화</li>
            <li>Android(객체) · iOS(문자열) 콜백 양쪽 정상 파싱</li>
            <li>Android 9·10 실기기에서 프롬프트 정상 표시</li>
          </ul>
        </section>
      </div>

      {running && <p className="running">Running: {running}</p>}

      {popup && (
        <div className="modal-backdrop" role="presentation">
          <section className="result-modal" role="dialog" aria-modal="true" aria-labelledby="auto-login-result-title">
            <div className="panel-heading">
              <h2 id="auto-login-result-title">{popup.title}</h2>
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
