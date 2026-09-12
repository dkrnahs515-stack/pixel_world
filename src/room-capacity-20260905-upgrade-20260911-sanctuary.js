export const PUBLIC_ROOM_CAPACITY = 10;

export async function claimRoomSlot({ dbModule, db, roomId, uid }) {
  for (let slotIndex = 0; slotIndex < PUBLIC_ROOM_CAPACITY; slotIndex += 1) {
    const slotRef = dbModule.ref(db, `rooms/${roomId}/slots/${slotIndex}`);
    let claimedFromEmpty = false;
    const transaction = await dbModule.runTransaction(slotRef, current => {
      if (current != null) return undefined;
      claimedFromEmpty = true;
      return uid;
    });
    if (!claimedFromEmpty || !transaction.committed || transaction.snapshot.val() !== uid) continue;

    const disconnectHandle = dbModule.onDisconnect(slotRef);
    await disconnectHandle.remove();
    let released = false;
    return {
      ok: true,
      slotIndex,
      slotRef,
      disconnectHandle,
      release: async () => {
        if (released) return;
        released = true;
        await disconnectHandle.cancel();
        await dbModule.remove(slotRef);
      },
    };
  }
  return { ok: false, reason: "room_full" };
}
