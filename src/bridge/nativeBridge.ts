export type BridgeResult = Record<string, unknown> | string | null;

export type NativeBridge = {
  getCurrentBeacon: (callbackName?: string, targetUuidsJson?: string) => BridgeResult | Promise<BridgeResult> | void;
  stopBeacon: () => BridgeResult | Promise<BridgeResult>;
  getDeviceToken: () => BridgeResult | Promise<BridgeResult>;
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
};

declare global {
  interface Window {
    SpcMobile?: NativeBridge;
    __spcBridgeAuthCallback?: (payload: BridgeResult) => void;
    __spcBridgePermissionCallback?: (payload: BridgeResult) => void;
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
