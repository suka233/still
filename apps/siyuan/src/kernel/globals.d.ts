// Timers installed by goja_nodejs's event loop (not covered by siyuan/kernel types).
declare function setTimeout(callback: () => void, ms?: number): unknown;
declare function clearTimeout(handle: unknown): void;
declare function setInterval(callback: () => void, ms?: number): unknown;
declare function clearInterval(handle: unknown): void;
