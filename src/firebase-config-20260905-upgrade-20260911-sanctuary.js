// Firebase 웹 앱 설정
// 이 객체는 Firebase 프로젝트 식별용 공개 설정입니다.
// 실제 데이터 접근 권한은 Authentication과 database.rules.json이 담당합니다.

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDdIPrv6cSEG2j74tPP7MJ4EAdPfH5wUzg",
  authDomain: "pixel-world-8cb9b.firebaseapp.com",
  databaseURL: "https://pixel-world-8cb9b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pixel-world-8cb9b",
  storageBucket: "pixel-world-8cb9b.firebasestorage.app",
  messagingSenderId: "244334952755",
  appId: "1:244334952755:web:816f3d8a04398457b23e46",
  measurementId: "G-5E1Y4BKT1F"
};

export function getFirebaseEmulatorConfig(locationRef = globalThis.location) {
  const local = ["127.0.0.1", "localhost"].includes(locationRef?.hostname);
  const enabled = new URLSearchParams(locationRef?.search || "").get("firebaseEmulator") === "1";
  return local && enabled ? {
    authUrl: "http://127.0.0.1:9099",
    databaseHost: "127.0.0.1",
    databasePort: 9000,
  } : null;
}
