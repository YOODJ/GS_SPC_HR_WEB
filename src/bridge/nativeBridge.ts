export type BridgeResult = Record<string, unknown> | string | null;

export type NativeBridge = {
  getCurrentBeacon: (callbackName?: string, targetUuidsJson?: string) => BridgeResult | Promise<BridgeResult> | void;
  /**
   * 스캔 창(5초) 동안 잡힌 비콘을 모두 모아 목록으로 한 번에 돌려준다.
   *
   * 구버전 앱에는 없다. 앱 배포는 원자적이지 않으므로 호출 전에 존재 여부를 확인하고,
   * 없으면 getCurrentBeacon 으로 물러나야 한다.
   */
  scanBeacons?: (callbackName: string, targetUuidsJson: string) => void;
  /**
   * scanBeacons 와 같지만 스캔 창 길이를 지정한다. 네이티브에서 1000~30000ms 로 clamp 된다.
   *
   * scanBeacons 에 인자를 추가하지 않고 이름을 나눈 이유: Android 브릿지는 이름+인자개수로
   * 메서드를 찾는데, 주입된 브릿지는 실제 JS 함수가 아니라 네이티브 객체라 Function.length 로
   * 시그니처를 확인할 수 없다. 즉 인자만 늘리면 구버전 앱에서 호출이 실패하는데 웹이 그것을
   * 미리 감지할 방법이 없다. 이름이 다르면 존재 여부로 분기할 수 있다.
   *
   * 구버전 앱에는 없다. 호출 전에 존재 여부를 확인하고, 없으면 scanBeacons(5초 고정)로 물러날 것.
   */
  scanBeaconsWithDuration?: (callbackName: string, targetUuidsJson: string, durationMs: number) => void;
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
  /**
   * 기기 인증 없이 아이디만 저장한다. enableAutoLogin 과 저장 위치도 효과도 같고 프롬프트만 없다.
   *
   * 인증이 없어지는 게 아니라 requestAutoLoginAuth 시점으로 미뤄지는 것이므로,
   * 이미 인증을 마쳤거나 getAutoLoginState().deviceAuth.available 을 확인한 뒤 호출해야 한다.
   * 구버전 앱에는 없으므로 호출 전 존재 여부를 확인할 것.
   */
  saveAutoLoginId?: (userId: string) => BridgeResult | Promise<BridgeResult>;
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

/** scanBeacons 결과. 실패해도 beacons 는 항상 있다. */
export type BeaconScanResult = {
  beacons: BeaconSighting[];
  error?: 'permissions_denied' | 'invalid_uuids_format';
};

export type BeaconSighting = {
  uuid: string;
  major: number;
  minor: number;
  /** 스캔 창에서 가장 강했던 값. 순간값은 잘 튀어서 최대값이 실제 거리에 가장 가깝다. */
  rssi: number;
  /** 스캔 창 동안 관측된 횟수. 스쳐 지나간 비콘과 계속 잡힌 비콘을 구분할 수 있다. */
  count: number;
};

declare global {
  interface Window {
    SpcMobile?: NativeBridge;
    __spcBridgeAuthCallback?: (payload: BridgeResult) => void;
    __spcBridgePermissionCallback?: (payload: BridgeResult) => void;
    __spcAutoLoginEnableCallback?: (payload: BridgeResult) => void;
    __spcAutoLoginAuthCallback?: (payload: BridgeResult) => void;
    myBeaconCallback?: (payload: BridgeResult) => void;
    __spcBeaconScanCallback?: (payload: BridgeResult) => void;
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
