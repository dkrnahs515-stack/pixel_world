import { FIREBASE_CONFIG, GAME_CONFIG as C, ROOM_ID } from "./config.js";
import { createFirebaseChatAdapter, createOfflineChatAdapter } from "./chat-network.js";
import { filterPlayersForMap, serializePlayerState } from "./network-state.js";
import { createPublishPolicyState, nextPublishDecision } from "./network-publish-policy.js";
import { claimRoomSlot } from "./room-capacity.js";
import { createCoopBossNetwork } from "./coop-boss-network.js";

export function createOfflineNetworkAdapter(mode = "solo", reason = "selected") {
  return {
    mode,
    reason,
    uid: "local-player",
    publish: () => {},
    chat: createOfflineChatAdapter(),
    coopBoss: null,
    stop: async () => {},
  };
}

async function defaultFirebaseModuleLoader() {
  const version = "12.16.0";
  const [appModule, authModule, dbModule] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-database.js`),
  ]);
  return { appModule, authModule, dbModule };
}

export async function createNetworkAdapter(callbacks = {}, dependencies = {}) {
  if (typeof callbacks === "function") {
    callbacks = {
      onPlayersChanged: callbacks,
      onStatusChanged: typeof dependencies === "function" ? dependencies : undefined,
    };
    dependencies = {};
  }
  const {
    onPlayersChanged,
    onStatusChanged,
    onChatMessagesChanged,
    onBossChanged,
    onBossAttackRequestsChanged,
    onBossPlayerDamageChanged,
    onBossRewardClaimsChanged,
    onConnectionLost,
    playMode = "solo",
  } = callbacks;
  const firebaseConfig = dependencies.firebaseConfig ?? FIREBASE_CONFIG;
  const loadFirebaseModules = dependencies.loadFirebaseModules ?? defaultFirebaseModuleLoader;
  const now = dependencies.now ?? (() => performance.now());
  const documentVisible = dependencies.documentVisible ?? (() => globalThis.document?.visibilityState !== "hidden");
  const setTimer = dependencies.setTimer ?? ((callback, delay) => setTimeout(callback, delay));
  const clearTimer = dependencies.clearTimer ?? (handle => clearTimeout(handle));

  if (playMode !== "online") {
    onStatusChanged?.("solo", "솔로");
    return createOfflineNetworkAdapter("solo", "selected");
  }

  if (!firebaseConfig?.apiKey || !firebaseConfig?.databaseURL) {
    onStatusChanged?.("offline", "Firebase 설정 필요");
    return createOfflineNetworkAdapter("solo", "firebase_unavailable");
  }

  onStatusChanged?.("connecting", "접속 중");

  let roomSlot = null;
  let activeFirebaseSession = null;
  try {
    const { appModule, authModule, dbModule } = await loadFirebaseModules();

    const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(firebaseConfig);
    const auth = authModule.getAuth(app);
    const user = auth.currentUser || (await authModule.signInAnonymously(auth)).user;
    const uid = user.uid;
    const db = dbModule.getDatabase(app);
    dbModule.goOnline?.(db);
    activeFirebaseSession = { authModule, auth, dbModule, db };
    roomSlot = await claimRoomSlot({ dbModule, db, roomId: ROOM_ID, uid });
    if (!roomSlot.ok) {
      dbModule.goOffline?.(db);
      onStatusChanged?.("solo", "온라인 정원 초과");
      return createOfflineNetworkAdapter("solo", "room_full");
    }
    const playerRef = dbModule.ref(db, `rooms/${ROOM_ID}/players/${uid}`);
    const connectedRef = dbModule.ref(db, ".info/connected");

    let stopped = false;
    let playerDisconnect = null;
    let everConnected = false;
    let disconnectTimer = null;
    let connectionLostDelivered = false;
    let activeMapId = "village";
    let unsubscribePlayers = null;
    let ownJoinedAt = Number.POSITIVE_INFINITY;
    let joinedAtWritePending = false;
    const unsubscribeOwnPlayer = dbModule.onValue(playerRef, snapshot => {
      const value = snapshot.val();
      ownJoinedAt = Number.isFinite(value?.joinedAt)
        ? value.joinedAt
        : Number.POSITIVE_INFINITY;
      joinedAtWritePending = false;
    });
    const subscribePlayersForMap = mapId => {
      unsubscribePlayers?.();
      const playersRef = dbModule.ref(db, `rooms/${ROOM_ID}/players`);
      const playersQuery = dbModule.query(
        playersRef,
        dbModule.orderByChild("mapId"),
        dbModule.equalTo(mapId),
      );
      unsubscribePlayers = dbModule.onValue(playersQuery, snapshot => {
        const rawPlayers = snapshot.val() || {};
        onPlayersChanged?.(filterPlayersForMap(rawPlayers, uid, mapId), { ownJoinedAt });
      });
    };
    subscribePlayersForMap(activeMapId);

    const chat = await createFirebaseChatAdapter({
      dbModule,
      db,
      uid,
      roomId: ROOM_ID,
      onMessagesChanged: onChatMessagesChanged,
    });
    const coopBoss = createCoopBossNetwork({
      dbModule,
      db,
      roomId: ROOM_ID,
      uid,
      onBossChanged,
      onAttackRequestsChanged: onBossAttackRequestsChanged,
      onPlayerDamageChanged: onBossPlayerDamageChanged,
      onRewardClaimsChanged: onBossRewardClaimsChanged,
    });

    const unsubscribeConnected = dbModule.onValue(connectedRef, async snapshot => {
      const online = snapshot.val() === true;
      if (!online) {
        onStatusChanged?.("connecting", "재연결 중");
        if (everConnected && disconnectTimer === null && !connectionLostDelivered) {
          disconnectTimer = setTimer(() => {
            disconnectTimer = null;
            if (stopped || connectionLostDelivered) return;
            connectionLostDelivered = true;
            onConnectionLost?.("connection_lost");
          }, C.CONNECTION_LOSS_GRACE_MS);
        }
        return;
      }
      everConnected = true;
      if (disconnectTimer !== null) clearTimer(disconnectTimer);
      disconnectTimer = null;
      try {
        playerDisconnect = dbModule.onDisconnect(playerRef);
        await Promise.all([playerDisconnect.remove(), chat.armDisconnect()]);
        if (!stopped) onStatusChanged?.("online", "온라인");
      } catch (error) {
        console.warn("접속 종료 자동 정리 예약 실패", error);
        if (!stopped) onStatusChanged?.("connecting", "재연결 중");
      }
    });

    let publishPolicy = createPublishPolicyState();
    const publish = (state, mapId = "village") => {
      if (stopped) return;
      if (mapId !== activeMapId) {
        activeMapId = mapId;
        subscribePlayersForMap(activeMapId);
      }
      const serialized = serializePlayerState(state, activeMapId);
      const decision = nextPublishDecision(publishPolicy, serialized, now(), documentVisible());
      publishPolicy = decision.policy;
      if (!decision.shouldPublish) return;
      const includeJoinedAt = !Number.isFinite(ownJoinedAt) && !joinedAtWritePending;
      const update = {
        ...serialized,
        updatedAt: dbModule.serverTimestamp(),
      };
      if (includeJoinedAt) {
        update.joinedAt = dbModule.serverTimestamp();
        joinedAtWritePending = true;
      }
      dbModule.update(playerRef, update).catch(error => {
        if (includeJoinedAt) joinedAtWritePending = false;
        console.warn("플레이어 위치 전송 실패", error);
      });
    };

    return {
      mode: "firebase",
      uid,
      get joinedAt() { return ownJoinedAt; },
      slotIndex: roomSlot.slotIndex,
      publish,
      chat,
      coopBoss,
      stop: async () => {
        if (stopped) return;
        stopped = true;
        if (disconnectTimer !== null) clearTimer(disconnectTimer);
        disconnectTimer = null;
        await coopBoss.stop();
        try {
          await roomSlot.release();
        } catch (error) {
          console.warn("온라인 슬롯 정리 실패", error);
        }
        unsubscribeOwnPlayer();
        unsubscribePlayers?.();
        unsubscribeConnected();
        await chat.stop();
        try {
          await playerDisconnect?.cancel();
          await dbModule.remove(playerRef);
        } catch (error) {
          console.warn("플레이어 퇴장 정보 정리 실패", error);
        }
        try {
          dbModule.goOffline?.(db);
        } catch (error) {
          console.warn("Firebase 세션 종료 실패", error);
        }
      },
    };
  } catch (error) {
    try {
      await roomSlot?.release?.();
    } catch {
      // 원래 연결 오류를 유지한다.
    }
    try {
      activeFirebaseSession?.dbModule?.goOffline?.(activeFirebaseSession.db);
    } catch {
      // 원래 연결 오류를 유지한다.
    }
    console.error("Firebase 연결 실패", error);
    onStatusChanged?.("offline", "연결 실패");
    return createOfflineNetworkAdapter("solo", "connection_failed");
  }
}
