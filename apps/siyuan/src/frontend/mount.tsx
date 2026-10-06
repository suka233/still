import { ScopeRegistry, mountStill, type MountContext } from "@still/ui";
import type { ReactNode } from "react";

/** Classes every Still scope carries in SiYuan; `still-siyuan` hooks host-specific CSS. */
export const SCOPE_CLASS = "still-siyuan";

export { ScopeRegistry, type MountContext };

/** Renders a Still view into a SiYuan element inside its own `.still-root` scope. */
export function mount(container: Element, node: ReactNode, ctx: MountContext, options?: { fill?: boolean }): () => void {
  return mountStill(container, node, ctx, options);
}
