import type { DueReminder } from "@still/core";
import type { StillClient } from "@still/ui";
import type { IKernelPluginRpc } from "siyuan";
import { RPC } from "../shared/rpc.js";

export interface SiyuanStillClient extends StillClient {
  pendingReminders(): Promise<DueReminder[]>;
  /** Returns the keys this window won; see the kernel's `claimReminders`. */
  claimReminders(keys: string[]): Promise<string[]>;
}

/** StillClient backed by the Still kernel plugin over SiYuan's JSON-RPC bridge. */
export function createRpcClient(rpc: IKernelPluginRpc): SiyuanStillClient {
  const call = rpc.call;
  return {
    snapshot: () => call[RPC.snapshot]!(),
    createSubscription: (input) => call[RPC.createSubscription]!(input),
    updateSubscription: (id, input) => call[RPC.updateSubscription]!(id, input),
    deleteSubscription: async (id) => {
      await call[RPC.deleteSubscription]!(id);
    },
    updateSettings: (patch) => call[RPC.updateSettings]!(patch),
    pendingReminders: () => call[RPC.pendingReminders]!(),
    claimReminders: (keys) => call[RPC.claimReminders]!(keys),
  };
}
