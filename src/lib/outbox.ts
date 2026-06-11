// Tiny IndexedDB outbox for offline expense creation. When the network is
// available again, syncOutbox() drains queued expenses to the server.
import { get, set, del, keys } from "idb-keyval";

const PREFIX = "outbox:expense:";

export type QueuedExpense = {
  id: string; // local id
  payload: Record<string, unknown>;
  queued_at: number;
};

export async function enqueueExpense(payload: Record<string, unknown>): Promise<QueuedExpense> {
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const item: QueuedExpense = { id, payload, queued_at: Date.now() };
  await set(PREFIX + id, item);
  return item;
}

export async function listQueued(): Promise<QueuedExpense[]> {
  const ks = (await keys()) as IDBValidKey[];
  const out: QueuedExpense[] = [];
  for (const k of ks) {
    if (typeof k === "string" && k.startsWith(PREFIX)) {
      const v = (await get(k)) as QueuedExpense | undefined;
      if (v) out.push(v);
    }
  }
  return out.sort((a, b) => a.queued_at - b.queued_at);
}

export async function removeQueued(id: string): Promise<void> {
  await del(PREFIX + id);
}

export async function syncOutbox(
  sender: (payload: Record<string, unknown>) => Promise<unknown>,
): Promise<{ sent: number; failed: number }> {
  const queue = await listQueued();
  let sent = 0;
  let failed = 0;
  for (const item of queue) {
    try {
      await sender(item.payload);
      await removeQueued(item.id);
      sent++;
    } catch {
      failed++;
    }
  }
  return { sent, failed };
}
