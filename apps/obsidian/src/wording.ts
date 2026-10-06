import type { MessageKey } from "@still/ui";

type Overrides = Partial<Record<MessageKey, string>>;

/**
 * Where Obsidian differs from the shared (SiYuan-first) wording: data lives in
 * a vault, and there is no background process — push only happens while
 * Obsidian is open on some device.
 */
const zh: Overrides = {
  "error.kernel": "续了么没能读取数据。请在 设置 → 续了么 里检查数据文件夹。",
  "settings.aboutText": "续了么 · {version}。数据以 JSON 文件保存在你的 Obsidian 库里，随库一起同步。",
  "push.description": "只要有一台设备开着 Obsidian，续费提醒就会推送到这些渠道。Obsidian 没有后台进程，全部关闭时不会推送。",
  "push.senderHint": "多台设备同步同一个库时，只让一台设备发送可以避免重复推送。",
};

const en: Overrides = {
  "error.kernel": "Still couldn't read its data. Check the data folder in Settings → Still.",
  "settings.aboutText": "Still · {version}. Data is kept as JSON files in your Obsidian vault and syncs with it.",
  "push.description": "While Obsidian is open on any device, renewal reminders are pushed here. Obsidian has no background process, so nothing is sent while it's closed everywhere.",
  "push.senderHint": "If several devices sync this vault, sending from one avoids duplicate pushes.",
};

export function overridesFor(locale: string): Overrides {
  return locale.startsWith("zh") ? zh : en;
}

/** Strings for Obsidian-only UI (settings tab, notices, commands). */
const own = {
  zh: {
    folder: "数据文件夹",
    folderDesc: "续了么把订阅保存在库里的这个文件夹中（每条记录一个 JSON 文件）。改名时会把已有数据一起搬过去。",
    folderMoved: "续了么的数据已移动到「{folder}」",
    folderTaken: "「{folder}」已经存在，没有移动数据。请换一个名字，或者手动合并。",
    folderInvalid: "请输入库里的一个文件夹路径",
    openDock: "打开即将扣费",
    openManager: "打开订阅管理",
    addSubscription: "添加订阅",
    confirm: "确定",
    cancel: "取消",
    saved: "已保存到「{path}」",
  },
  en: {
    folder: "Data folder",
    folderDesc: "Still keeps your subscriptions in this vault folder (one JSON file per record). Renaming it moves the existing data.",
    folderMoved: "Still's data moved to “{folder}”",
    folderTaken: "“{folder}” already exists, so nothing was moved. Pick another name or merge by hand.",
    folderInvalid: "Enter a folder path inside the vault",
    openDock: "Open upcoming charges",
    openManager: "Open subscriptions",
    addSubscription: "Add subscription",
    confirm: "OK",
    cancel: "Cancel",
    saved: "Saved to “{path}”",
  },
};

export type OwnKey = keyof (typeof own)["en"];

export function ownTranslator(locale: string) {
  const table = locale.startsWith("zh") ? own.zh : own.en;
  return (key: OwnKey, vars: Record<string, string> = {}) => {
    let text: string = table[key];
    for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(v);
    return text;
  };
}
