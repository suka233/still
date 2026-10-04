import { createContext, useContext, type ReactNode } from "react";

/**
 * Radix portals default to `document.body`, which is outside the `.still-root`
 * scope our styles and theme tokens apply to. Hosts provide a container that
 * carries the `still-root` class instead.
 */
const PortalContainerContext = createContext<HTMLElement | null>(null);

export function PortalContainerProvider({ container, children }: { container: HTMLElement | null; children: ReactNode }) {
  return <PortalContainerContext.Provider value={container}>{children}</PortalContainerContext.Provider>;
}

export function usePortalContainer(): HTMLElement | undefined {
  return useContext(PortalContainerContext) ?? undefined;
}
