export type BridgeResult = Record<string, unknown> | string | null;

export type NativeBridge = {
  getCurrentBeacon: (callbackName?: string, targetUuidsJson?: string) => BridgeResult | Promise<BridgeResult> | void;
  stopBeacon: () => BridgeResult | Promise<BridgeResult>;
  getDeviceInfo: () => BridgeResult | Promise<BridgeResult>;
  saveRefreshToken: (token: string) => BridgeResult | Promise<BridgeResult>;
  getRefreshToken: () => BridgeResult | Promise<BridgeResult>;
  hasRefreshToken: () => BridgeResult | Promise<BridgeResult>;
  clearRefreshToken: () => BridgeResult | Promise<BridgeResult>;
  setBiometricLoginEnabled: (enabled: boolean) => BridgeResult | Promise<BridgeResult>;
  isBiometricLoginEnabled: () => BridgeResult | Promise<BridgeResult>;
  getBiometricAvailability: () => BridgeResult | Promise<BridgeResult>;
  requestBiometricAuth: (callbackName?: string) => BridgeResult | Promise<BridgeResult>;
  testCallback?: (callbackName: string) => BridgeResult | Promise<BridgeResult>;
  hasPermissions: (callbackName: string, targetPermissionsJson: string) => void;
  openAppSettings: () => void;
  showBottomTab: (mode: number) => void;

  // 자동로그인. 비동기 2개는 callbackName 방식으로 결과를 전달한다.
  getAutoLoginState: () => BridgeResult | Promise<BridgeResult>;
  disableAutoLogin: () => BridgeResult | Promise<BridgeResult>;
  enableAutoLogin: (callbackName: string, userId: string) => void;
  requestAutoLoginAuth: (callbackName: string) => void;
};

/** 자동로그인 브릿지가 돌려주는 기기 인증 상태 */
export type AutoLoginState = {
  success: boolean;
  hasUserId: boolean;
  userId: string;
  deviceAuth: {
    available: boolean;
    type: 'biometric' | 'deviceCredential' | 'none';
  };
};

/** enableAutoLogin / requestAutoLoginAuth 콜백 결과 */
export type DeviceAuthResult = {
  success: boolean;
  reason: 'ok' | 'canceled' | 'failed' | 'lockout' | 'unavailable';
  message: string;
  /** 인증 성공 시 저장된 아이디, 실패 시 빈 문자열. (구버전 앱에서는 없을 수 있다) */
  userId?: string;
};

declare global {
  interface Window {
    SpcMobile?: NativeBridge;
    __spcBridgeAuthCallback?: (payload: BridgeResult) => void;
    __spcBridgePermissionCallback?: (payload: BridgeResult) => void;
    __spcAutoLoginEnableCallback?: (payload: BridgeResult) => void;
    __spcAutoLoginAuthCallback?: (payload: BridgeResult) => void;
    myBeaconCallback?: (payload: BridgeResult) => void;
    myTestCallback?: (payload: BridgeResult) => void;
  }
}

export function normalizeResult(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
