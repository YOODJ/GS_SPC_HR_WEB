# SPC HR Mobile Hybrid Web Bridge 명세서

SPC HR 모바일 앱(Android/iOS)과 웹(Web) 간의 통신을 담당하는 Native Bridge 연동 가이드라인입니다. JavaScript 전역 객체인 `window.SpcMobile`을 사용하여 호출할 수 있습니다.

---

## 1. 기기 정보 및 FCM 토큰 조회

### `getDeviceToken()`
사용자 기기의 FCM 토큰 값과 보안 영역에 생성되어 보관되는 앱 고유 기기식별자(UUID)를 동기식으로 즉시 조회합니다.

* **호출 방식:** 동기 (직접 반환값 수신)
* **메서드 서명:** `window.SpcMobile.getDeviceToken() -> String (JSON 포맷)`

#### 반환 데이터 포맷 (JSON String)
| 필드명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `success` | Boolean | FCM 토큰이 유효하게 존재하는지 여부 (`true` / `false`) |
| `fcmToken` | String | 기기에 할당된 Firebase Cloud Messaging 토큰 값 (미할당 시 빈 문자열 `""`) |
| `uuid` | String | 앱 최초 실행 시 자동 생성되어 기기 저장소에 고유하게 보관되는 암호화 기기 식별자 (UUID) |

#### JavaScript 사용 예시
```javascript
try {
  const resultJsonString = window.SpcMobile.getDeviceToken();
  const deviceTokenInfo = JSON.parse(resultJsonString);

  if (deviceTokenInfo.success) {
    console.log("FCM 토큰:", deviceTokenInfo.fcmToken);
    console.log("기기 고유 UUID:", deviceTokenInfo.uuid);
    
    // TODO: 백엔드 서버로 기기 토큰 전송 및 매핑 처리
  } else {
    console.warn("FCM 토큰이 아직 발급되지 않았습니다. UUID:", deviceTokenInfo.uuid);
  }
} catch (e) {
  console.error("Native Bridge 호출 실패:", e);
}
```

---

## 2. iBeacon 스캔 및 탐지

### `getCurrentBeacon(callbackName, targetUuidsJson)`
지정된 여러 개의 iBeacon UUID 목록을 기기 블루투스(BLE) 스캐너를 통해 5초 동안 실시간 탐지하고, 일치하는 비콘 데이터를 비동기(Callback) 형태로 전달합니다.

* **호출 방식:** 비동기 콜백 (Callback 함수 지정)
* **메서드 서명:** `window.SpcMobile.getCurrentBeacon(callbackName: String, targetUuidsJson: String) -> Void`

#### 매개변수 설명
1. **`callbackName` (String):**
   * 비콘 데이터 수신 시 호출될 **전역(Window 스코프) JavaScript 콜백 함수명**입니다.
2. **`targetUuidsJson` (String - JSON Array Serialized):**
   * 스캔 필터링 대상이 될 16바이트 iBeacon Proximity UUID들의 배열을 **JSON Stringify** 하여 전달합니다.
   * 대소문자는 구분하지 않습니다. (예: `JSON.stringify(["74278BDA-B644-4520-8F0C-720EAF059935", "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0"])`)

#### 콜백 함수로 전달되는 데이터 포맷 (JSON String)

##### A. 성공 시 (비콘 감지됨)
| 필드명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `uuid` | String | 감지된 비콘의 Proximity UUID (대문자 규격) |
| `major` | Integer | 감지된 비콘의 Major 값 (0 ~ 65535) |
| `minor` | Integer | 감지된 비콘의 Minor 값 (0 ~ 65535) |
| `rssi` | Integer | 신호 수신 세기 (음수 값, 0에 가까울수록 비콘 기기와 인접함) |

##### B. 실패 및 예외 상황
수행 도중 비콘을 찾지 못하거나 기기 문제 발생 시 다음 에러 페이로드가 콜백으로 즉시 호출됩니다.
* **시간 초과 (5초 동안 대상 비콘 감지 실패):** 빈 문자열 `""` (공백 없음)
* **블루투스/위치 권한 거부:** `{"error":"permissions_denied"}`
* **전달한 UUID 목록 JSON 포맷 불량:** `{"error":"invalid_uuids_format"}`

#### JavaScript 사용 예시
```javascript
// 1. 결과 데이터를 받아 처리할 전역 콜백 함수 선언
window.onBeaconScanned = function(resultJsonString) {
  // 시간 초과 시 빈 문자열이 반환됩니다.
  if (!resultJsonString) {
    alert("주변에서 출퇴근 비콘 신호를 찾을 수 없습니다. (시간 초과)");
    return;
  }

  const result = JSON.parse(resultJsonString);

  if (result.error) {
    if (result.error === "permissions_denied") {
      alert("앱의 위치 및 블루투스 권한 허용이 필요합니다.");
    } else {
      alert("비콘 스캔 에러: " + result.error);
    }
    return;
  }

  // 비콘 탐지 성공 시 로직 처리
  console.log("감지된 비콘 UUID:", result.uuid);
  console.log("Major / Minor:", result.major, "/", result.minor);
  console.log("수신 신호 강도(RSSI):", result.rssi);
  
  // TODO: 서버 측 출퇴근 API 검증 호출 진행
};

// 2. 검색할 대상 비콘 UUID 설정 후 네이티브 스캔 요청 트리거
const allowedUuids = [
  "74278BDA-B644-4520-8F0C-720EAF059935",
  "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0"
];

try {
  // targetUuids를 반드시 JSON.stringify로 직렬화하여 호출
  window.SpcMobile.getCurrentBeacon("onBeaconScanned", JSON.stringify(allowedUuids));
} catch (e) {
  console.error("비콘 스캔 Native Bridge 호출에 실패했습니다:", e);
}
```

---

## 3. 권한 상태 및 앱 설정 제어

### `hasPermissions(callbackName, targetPermissionsJson)`
확인하고자 하는 권한 리스트(JSON 배열)를 인자로 받아, 각 권한의 상태를 키-값 형태의 JSON Map으로 비동기(Callback) 형태로 전달합니다.

* **호출 방식:** 비동기 콜백 (Callback 함수 지정)
* **메서드 서명:** `window.SpcMobile.hasPermissions(callbackName: String, targetPermissionsJson: String) -> Void`

#### 매개변수 설명
1. **`callbackName` (String):**
   * 권한 여부 수신 시 호출될 **전역(Window 스코프) JavaScript 콜백 함수명**입니다.
2. **`targetPermissionsJson` (String - JSON Array):**
   * 확인 대상 권한 키들의 배열을 **JSON Stringify** 하여 전달합니다.
   * 지원 권한 키 목록:
     * `"location"`: 위치 권한
     * `"bluetooth"`: 블루투스 BLE 권한
     * `"camera"`: 카메라 권한
     * `"notification"`: 알림 권한
     * `"gallery"`: 사진첩/갤러리 접근 권한
     * `"storage"`: 저장소 파일 접근 권한 (iOS의 경우 샌드박싱 구조상 항상 `true` 반환)

#### 콜백 함수로 전달되는 데이터 포맷 (JSON String)
| 필드명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `success` | Boolean | 상태 조회 성공 여부 (`true` / `false`) |
| `permissions` | Object | 요청한 권한 키별 상태 맵 (각 권한 명칭에 대한 `true` 또는 `false` 허용 상태) |

#### JavaScript 사용 예시
```javascript
// 1. 권한 여부를 응답받을 콜백 선언
window.onPermissionsChecked = function(resultJsonString) {
  const result = JSON.parse(resultJsonString);
  if (result.success) {
    console.log("위치 권한 상태:", result.permissions.location);
    console.log("블루투스 권한 상태:", result.permissions.bluetooth);
    console.log("알림 권한 상태:", result.permissions.notification);
    console.log("사진첩 권한 상태:", result.permissions.gallery);
    
    if (result.permissions.location && result.permissions.bluetooth) {
      // 비콘 기능 실행
    } else {
      // 설정화면으로 유도
    }
  } else {
    console.error("권한 체크 실패:", result.message);
  }
};

// 2. 권한 체크 요청 실행
const checkKeys = ["location", "bluetooth", "notification", "gallery"];
try {
  window.SpcMobile.hasPermissions("onPermissionsChecked", JSON.stringify(checkKeys));
} catch (e) {
  console.error("hasPermissions 브릿지 호출 실패:", e);
}
```

---

### `openAppSettings()`
사용자가 앱의 블루투스 및 위치 권한을 수동으로 제어(활성화)할 수 있도록 스마트폰 시스템의 **앱 상세 설정 화면**으로 즉시 이동시킵니다.

* **호출 방식:** 단방향 호출 (설정 화면으로 이탈)
* **메서드 서명:** `window.SpcMobile.openAppSettings() -> Void`

#### JavaScript 사용 예시
```javascript
try {
  // 사용자의 명시적 동의(예: 확인 팝업 터치)를 거친 후 호출할 것을 적극 권장합니다.
  if (confirm("비콘 스캔 권한이 필요합니다. 설정창으로 이동하여 권한을 허용하시겠습니까?")) {
    window.SpcMobile.openAppSettings();
  }
} catch (e) {
  console.error("openAppSettings 호출 실패:", e);
}
```
