import { upcomingCharges, type DueReminder, type LocalDate, type Subscription } from "@still/core";
import {
  ManagerView,
  ReminderDialog,
  UpcomingPanel,
  createStillStore,
  createTranslate,
  formatDaysLeft,
  formatMoney,
  resolveMessages,
  type StillHost,
  type StillStore,
  type Translate,
} from "@still/ui";
import { Dialog, Plugin, confirm, getFrontend, openTab, platformUtils, showMessage } from "siyuan";
import { RPC, type RemindersDueParams } from "../shared/rpc.js";
import { createRpcClient, type SiyuanStillClient } from "./client.js";
import { ICONS } from "./icons.js";
import "./index.css";
import { mount, type MountContext } from "./mount.js";

const TAB_TYPE = "manager";
const DOCK_TYPE = "upcoming";

export default class StillPlugin extends Plugin {
  #client!: SiyuanStillClient;
  #store!: StillStore;
  #ctx!: MountContext;
  #t!: Translate;
  #locale = "en";
  #isMobile = false;
  #portal: HTMLElement | null = null;
  #statusBar: HTMLElement | null = null;
  #cleanups: (() => void)[] = [];

  override onload() {
    // Publish (read-only) sessions can't reach the kernel plugin's RPC.
    const config = window.siyuan.config;
    if (!config || config.readonly || window.siyuan.isPublish) return;

    const lang = config.lang;
    const { locale, messages } = resolveMessages(lang);
    this.#locale = locale;
    this.#t = createTranslate(messages);
    this.#isMobile = getFrontend() === "mobile" || getFrontend() === "browser-mobile";

    this.#client = createRpcClient(this.kernel.rpc);
    this.#store = createStillStore(this.#client);

    this.#portal = document.createElement("div");
    this.#portal.className = "still-root still-siyuan still-portal";
    document.body.append(this.#portal);

    const host: StillHost = {
      openUrl: (url) => window.open(url, "_blank", "noopener"),
      confirm: (text) =>
        new Promise((resolve) => confirm(this.#t("appName"), text, () => resolve(true), () => resolve(false))),
      toast: (text) => showMessage(text),
    };
    this.#ctx = { store: this.#store, host, lang, portalContainer: this.#portal };

    // The reminder card has no visible anchor of its own; it lives in the portal.
    const reminderAnchor = document.createElement("div");
    this.#portal.append(reminderAnchor);
    this.#cleanups.push(mount(reminderAnchor, <ReminderDialog />, this.#ctx));

    this.addIcons(ICONS);
    this.#registerDock();
    this.#registerTab();
    this.addTopBar({
      icon: "iconStill",
      title: this.#t("appName"),
      position: "right",
      callback: () => this.openManager(),
    });
    this.addCommand({
      langKey: "openManager",
      langText: this.#t("allSubscriptions"),
      hotkey: "",
      callback: () => this.openManager(),
    });
    this.#registerStatusBar();

    this.kernel.rpc.bind(RPC.notifyChanged, this.#onChanged);
    this.kernel.rpc.bind(RPC.notifyRemindersDue, this.#onRemindersDue);
    this.eventBus.on("kernel-plugin-state-change", this.#onKernelState);
  }

  override async onLayoutReady() {
    if (!this.#store) return;
    await this.#sync();
  }

  override onunload() {
    if (!this.#store) return;
    this.kernel.rpc.unbind(RPC.notifyChanged, this.#onChanged);
    this.kernel.rpc.unbind(RPC.notifyRemindersDue, this.#onRemindersDue);
    this.eventBus.off("kernel-plugin-state-change", this.#onKernelState);
    for (const cleanup of this.#cleanups.splice(0)) cleanup();
    this.#store.getState().dispose();
    this.#portal?.remove();
    this.#portal = null;
  }

  openManager() {
    if (this.#isMobile) {
      // `openTab` is a no-op on mobile; use a full-screen dialog instead.
      const dialog = new Dialog({ title: this.#t("appName"), content: "<div></div>", width: "100vw", height: "100vh" });
      const unmount = mount(dialog.element.querySelector(".b3-dialog__body")!, <ManagerView />, this.#ctx);
      const destroy = dialog.destroy.bind(dialog);
      dialog.destroy = (options) => {
        unmount();
        destroy(options);
      };
      return;
    }
    openTab({ app: this.app, custom: { icon: "iconStill", title: this.#t("appName"), id: this.name + TAB_TYPE } });
  }

  #registerDock() {
    const ctx = () => this.#ctx;
    let unmount: (() => void) | null = null;
    this.addDock({
      type: DOCK_TYPE,
      config: {
        position: "RightTop",
        size: { width: 300, height: 0 },
        icon: "iconStill",
        title: this.#t("appName"),
      },
      data: {},
      init() {
        unmount?.();
        unmount = mount(this.element, <UpcomingPanel />, ctx());
      },
      destroy() {
        unmount?.();
        unmount = null;
      },
    });
    this.#cleanups.push(() => unmount?.());
  }

  #registerTab() {
    const ctx = () => this.#ctx;
    const unmounts = new WeakMap<object, () => void>();
    this.addTab({
      type: TAB_TYPE,
      init() {
        (this.element as HTMLElement).style.overflow = "auto";
        unmounts.set(this, mount(this.element, <ManagerView />, ctx()));
      },
      destroy() {
        unmounts.get(this)?.();
      },
    });
  }

  #registerStatusBar() {
    const el = document.createElement("div");
    el.className = "toolbar__item still-statusbar";
    el.setAttribute("aria-label", this.#t("appName"));
    el.addEventListener("click", () => this.openManager());
    this.#statusBar = this.addStatusBar({ element: el, position: "right" });

    const render = () => {
      const { subscriptions, today, status } = this.#store.getState();
      if (status !== "ready" || !this.#statusBar) return;
      const next = nextChargeWithinWeek(subscriptions, today);
      const label = next
        ? `${next.subscription.name} · ${formatDaysLeft(next.daysLeft, this.#t)}`
        : "";
      el.innerHTML = label ? `<svg><use xlink:href="#iconStill"></use></svg><span></span>` : "";
      el.querySelector("span")?.append(label);
      el.title = next ? formatMoney(next.subscription.price, this.#locale) : "";
    };
    this.#cleanups.push(this.#store.subscribe(render));
  }

  async #sync() {
    await this.#store.getState().refresh();
    try {
      await this.#deliver(await this.#client.pendingReminders());
    } catch (e) {
      console.warn("[still] pendingReminders failed", e);
    }
  }

  async #deliver(reminders: DueReminder[]) {
    if (reminders.length === 0) return;
    const claimed = new Set(await this.#client.claimReminders(reminders.map((r) => r.key)));
    const mine = reminders.filter((r) => claimed.has(r.key));
    if (mine.length === 0) return;
    await this.#store.getState().refresh();
    const { subscriptions } = this.#store.getState();
    for (const r of mine) {
      const sub = subscriptions.find((s) => s.id === r.subscriptionId);
      if (!sub) continue;
      const when = formatDaysLeft(r.daysLeft, this.#t);
      void platformUtils.sendNotification({
        title: this.#t(r.kind === "trial-ending" ? "notification.trialTitle" : "notification.title", { name: sub.name, when }),
        body: this.#t("notification.body", { price: formatMoney(sub.price, this.#locale) }),
      });
    }
    this.#store.getState().enqueueReminders(mine);
  }

  readonly #onChanged = () => {
    void this.#store.getState().refresh();
  };

  readonly #onRemindersDue = (...args: unknown[]) => {
    const params = args[0] as RemindersDueParams | undefined;
    void this.#deliver(params?.reminders ?? []).catch((e) => console.warn("[still] deliver failed", e));
  };

  readonly #onKernelState = ({ detail }: CustomEvent<{ code: number }>) => {
    if (detail.code === 2) void this.#sync(); // running
  };
}

/** Soonest charge within the next week, for the status bar. */
function nextChargeWithinWeek(subscriptions: Subscription[], today: LocalDate) {
  const [first] = upcomingCharges(subscriptions, today);
  return first && first.daysLeft <= 7 ? first : null;
}
