import type { BillingCycle } from "@still/core";

/**
 * Well-known services offered as presets when adding a subscription.
 *
 * Prices are intentionally absent: they differ by region and change often.
 * `cancelUrl` is only set where the provider has a stable, official
 * account/subscription page.
 */
export type CategoryId =
  | "video"
  | "music"
  | "ai"
  | "storage"
  | "productivity"
  | "dev"
  | "design"
  | "security"
  | "gaming"
  | "reading"
  | "learning"
  | "social"
  | "fitness"
  | "hosting"
  | "other";

export const CATEGORY_IDS: readonly CategoryId[] = [
  "video",
  "music",
  "ai",
  "storage",
  "productivity",
  "dev",
  "design",
  "security",
  "gaming",
  "reading",
  "learning",
  "social",
  "fitness",
  "hosting",
  "other",
];

export interface CatalogService {
  id: string;
  name: string;
  /** Chinese display name when it differs. */
  zh?: string;
  /** Extra search terms. */
  aliases?: string[];
  category: CategoryId;
  /** Brand colour, `#rrggbb`. */
  color: string;
  /** simple-icons slug, when the brand is in the set. */
  icon?: string;
  url: string;
  cancelUrl?: string;
  cycle?: BillingCycle;
  /** Mostly used in mainland China; ranked first for Chinese users. */
  cn?: boolean;
}

const yearly: BillingCycle = { unit: "year", every: 1 };
const APPLE_SUBS = "https://apps.apple.com/account/subscriptions";
const GOOGLE_PLAY_SUBS = "https://play.google.com/store/account/subscriptions";

export const SERVICES: readonly CatalogService[] = [
  // Video
  { id: "netflix", name: "Netflix", category: "video", color: "#E50914", icon: "netflix", url: "https://www.netflix.com", cancelUrl: "https://www.netflix.com/cancelplan", aliases: ["网飞", "奈飞"] },
  { id: "youtube-premium", name: "YouTube Premium", category: "video", color: "#FF0000", icon: "youtube", url: "https://www.youtube.com/premium", cancelUrl: "https://www.youtube.com/paid_memberships", aliases: ["油管"] },
  { id: "disney-plus", name: "Disney+", category: "video", color: "#113CCF", url: "https://www.disneyplus.com", cancelUrl: "https://www.disneyplus.com/account", aliases: ["迪士尼"] },
  { id: "prime-video", name: "Amazon Prime", category: "video", color: "#00A8E1", url: "https://www.amazon.com/prime", cancelUrl: "https://www.amazon.com/gp/primecentral", aliases: ["亚马逊"] },
  { id: "max", name: "Max", category: "video", color: "#002BE7", icon: "hbomax", url: "https://www.max.com", aliases: ["HBO"] },
  { id: "apple-tv", name: "Apple TV+", category: "video", color: "#000000", icon: "appletv", url: "https://tv.apple.com", cancelUrl: APPLE_SUBS },
  { id: "paramount-plus", name: "Paramount+", category: "video", color: "#0064FF", icon: "paramountplus", url: "https://www.paramountplus.com" },
  { id: "crunchyroll", name: "Crunchyroll", category: "video", color: "#F47521", icon: "crunchyroll", url: "https://www.crunchyroll.com" },
  { id: "twitch", name: "Twitch Turbo", category: "video", color: "#9146FF", icon: "twitch", url: "https://www.twitch.tv" },
  { id: "plex", name: "Plex Pass", category: "video", color: "#EBAF00", icon: "plex", url: "https://www.plex.tv" },
  { id: "bilibili", name: "bilibili 大会员", zh: "B 站大会员", category: "video", color: "#00A1D6", icon: "bilibili", url: "https://www.bilibili.com", aliases: ["哔哩哔哩", "b站", "大会员"], cn: true, cycle: yearly },
  { id: "iqiyi", name: "iQIYI VIP", zh: "爱奇艺 VIP", category: "video", color: "#00BE06", url: "https://www.iqiyi.com", aliases: ["爱奇艺"], cn: true },
  { id: "tencent-video", name: "Tencent Video VIP", zh: "腾讯视频 VIP", category: "video", color: "#FF6022", url: "https://v.qq.com", aliases: ["腾讯视频"], cn: true },
  { id: "youku", name: "Youku VIP", zh: "优酷 VIP", category: "video", color: "#1EBDFF", url: "https://www.youku.com", aliases: ["优酷"], cn: true },
  { id: "mango-tv", name: "Mango TV", zh: "芒果 TV", category: "video", color: "#FF5F00", url: "https://www.mgtv.com", aliases: ["芒果"], cn: true },

  // Music & audio
  { id: "spotify", name: "Spotify Premium", category: "music", color: "#1DB954", icon: "spotify", url: "https://www.spotify.com", cancelUrl: "https://www.spotify.com/account/subscription/" },
  { id: "apple-music", name: "Apple Music", category: "music", color: "#FA243C", icon: "applemusic", url: "https://music.apple.com", cancelUrl: APPLE_SUBS },
  { id: "youtube-music", name: "YouTube Music", category: "music", color: "#FF0000", icon: "youtubemusic", url: "https://music.youtube.com", cancelUrl: "https://www.youtube.com/paid_memberships" },
  { id: "tidal", name: "TIDAL", category: "music", color: "#000000", icon: "tidal", url: "https://tidal.com" },
  { id: "deezer", name: "Deezer", category: "music", color: "#A238FF", icon: "deezer", url: "https://www.deezer.com" },
  { id: "audible", name: "Audible", category: "music", color: "#F8991C", icon: "audible", url: "https://www.audible.com" },
  { id: "netease-music", name: "NetEase Cloud Music", zh: "网易云音乐黑胶 VIP", category: "music", color: "#C20C0C", icon: "neteasecloudmusic", url: "https://music.163.com", aliases: ["网易云", "黑胶"], cn: true },
  { id: "qq-music", name: "QQ Music", zh: "QQ 音乐绿钻", category: "music", color: "#31C27C", url: "https://y.qq.com", aliases: ["QQ音乐", "绿钻"], cn: true },
  { id: "ximalaya", name: "Ximalaya", zh: "喜马拉雅会员", category: "music", color: "#F86442", url: "https://www.ximalaya.com", aliases: ["喜马拉雅"], cn: true },

  // AI
  { id: "chatgpt", name: "ChatGPT Plus", category: "ai", color: "#10A37F", url: "https://chatgpt.com", cancelUrl: "https://chatgpt.com/#settings/Subscription", aliases: ["openai", "gpt"] },
  { id: "claude", name: "Claude Pro", category: "ai", color: "#D97757", icon: "claude", url: "https://claude.ai", cancelUrl: "https://claude.ai/settings/billing", aliases: ["anthropic"] },
  { id: "gemini", name: "Google AI Pro", category: "ai", color: "#8E75B2", icon: "googlegemini", url: "https://gemini.google.com", cancelUrl: GOOGLE_PLAY_SUBS, aliases: ["gemini", "google one"] },
  { id: "perplexity", name: "Perplexity Pro", category: "ai", color: "#1FB8CD", icon: "perplexity", url: "https://www.perplexity.ai" },
  { id: "midjourney", name: "Midjourney", category: "ai", color: "#000000", url: "https://www.midjourney.com" },
  { id: "cursor", name: "Cursor Pro", category: "ai", color: "#000000", icon: "cursor", url: "https://cursor.com" },
  { id: "github-copilot", name: "GitHub Copilot", category: "ai", color: "#000000", icon: "githubcopilot", url: "https://github.com/features/copilot", cancelUrl: "https://github.com/settings/billing" },
  { id: "deepl", name: "DeepL Pro", category: "ai", color: "#0F2B46", icon: "deepl", url: "https://www.deepl.com" },
  { id: "grammarly", name: "Grammarly Premium", category: "ai", color: "#15C39A", icon: "grammarly", url: "https://www.grammarly.com" },
  { id: "kimi", name: "Kimi", category: "ai", color: "#000000", url: "https://kimi.moonshot.cn", cn: true },

  // Storage & cloud
  { id: "icloud", name: "iCloud+", category: "storage", color: "#3693F3", icon: "icloud", url: "https://www.icloud.com", cancelUrl: APPLE_SUBS },
  { id: "google-one", name: "Google One", category: "storage", color: "#4285F4", icon: "googledrive", url: "https://one.google.com", cancelUrl: GOOGLE_PLAY_SUBS },
  { id: "dropbox", name: "Dropbox", category: "storage", color: "#0061FF", icon: "dropbox", url: "https://www.dropbox.com", cancelUrl: "https://www.dropbox.com/account/plan" },
  { id: "onedrive", name: "Microsoft 365", category: "storage", color: "#D83B01", url: "https://www.microsoft.com/microsoft-365", cancelUrl: "https://account.microsoft.com/services", aliases: ["office", "onedrive"] },
  { id: "mega", name: "MEGA", category: "storage", color: "#D9272E", icon: "mega", url: "https://mega.io" },
  { id: "backblaze", name: "Backblaze", category: "storage", color: "#E21E29", icon: "backblaze", url: "https://www.backblaze.com" },
  { id: "baidu-netdisk", name: "Baidu Netdisk", zh: "百度网盘超级会员", category: "storage", color: "#06A7FF", icon: "baidu", url: "https://pan.baidu.com", aliases: ["百度网盘", "超级会员", "svip"], cn: true },
  { id: "aliyun-drive", name: "Alibaba Cloud Drive", zh: "阿里云盘", category: "storage", color: "#637DFF", url: "https://www.aliyundrive.com", aliases: ["阿里云盘"], cn: true },
  { id: "siyuan-sync", name: "SiYuan Subscription", zh: "思源笔记订阅", category: "storage", color: "#D23F31", url: "https://b3log.org/siyuan", aliases: ["思源", "siyuan"], cn: true, cycle: yearly },

  // Productivity
  { id: "notion", name: "Notion", category: "productivity", color: "#000000", icon: "notion", url: "https://www.notion.so" },
  { id: "obsidian-sync", name: "Obsidian Sync", category: "productivity", color: "#7C3AED", icon: "obsidian", url: "https://obsidian.md/sync" },
  { id: "evernote", name: "Evernote", category: "productivity", color: "#00A82D", icon: "evernote", url: "https://evernote.com", aliases: ["印象笔记"] },
  { id: "todoist", name: "Todoist Pro", category: "productivity", color: "#E44332", icon: "todoist", url: "https://todoist.com" },
  { id: "ticktick", name: "TickTick Premium", zh: "滴答清单高级会员", category: "productivity", color: "#4772FA", icon: "ticktick", url: "https://ticktick.com", aliases: ["滴答清单"] },
  { id: "raycast", name: "Raycast Pro", category: "productivity", color: "#FF6363", icon: "raycast", url: "https://www.raycast.com" },
  { id: "setapp", name: "Setapp", category: "productivity", color: "#E6C3A5", icon: "setapp", url: "https://setapp.com" },
  { id: "zoom", name: "Zoom", category: "productivity", color: "#0B5CFF", icon: "zoom", url: "https://zoom.us" },
  { id: "wps", name: "WPS 会员", category: "productivity", color: "#E41C1C", url: "https://www.wps.cn", aliases: ["wps"], cn: true },
  { id: "xmind", name: "Xmind", category: "productivity", color: "#F04E23", url: "https://xmind.app" },

  // Dev
  { id: "github", name: "GitHub Pro", category: "dev", color: "#181717", icon: "github", url: "https://github.com", cancelUrl: "https://github.com/settings/billing" },
  { id: "jetbrains", name: "JetBrains", category: "dev", color: "#000000", icon: "jetbrains", url: "https://www.jetbrains.com", cycle: yearly },
  { id: "vercel", name: "Vercel Pro", category: "dev", color: "#000000", icon: "vercel", url: "https://vercel.com" },
  { id: "netlify", name: "Netlify", category: "dev", color: "#00C7B7", icon: "netlify", url: "https://www.netlify.com" },

  // Hosting & domains
  { id: "cloudflare", name: "Cloudflare", category: "hosting", color: "#F38020", icon: "cloudflare", url: "https://www.cloudflare.com" },
  { id: "digitalocean", name: "DigitalOcean", category: "hosting", color: "#0080FF", icon: "digitalocean", url: "https://www.digitalocean.com" },
  { id: "vultr", name: "Vultr", category: "hosting", color: "#007BFC", icon: "vultr", url: "https://www.vultr.com" },
  { id: "aws", name: "AWS", category: "hosting", color: "#232F3E", url: "https://aws.amazon.com" },
  { id: "aliyun", name: "Alibaba Cloud", zh: "阿里云", category: "hosting", color: "#FF6A00", url: "https://www.aliyun.com", aliases: ["阿里云", "ecs"], cn: true },
  { id: "tencent-cloud", name: "Tencent Cloud", zh: "腾讯云", category: "hosting", color: "#00A3FF", url: "https://cloud.tencent.com", aliases: ["腾讯云"], cn: true },
  { id: "namecheap", name: "Namecheap", category: "hosting", color: "#DE3723", icon: "namecheap", url: "https://www.namecheap.com", cycle: yearly, aliases: ["domain", "域名"] },
  { id: "porkbun", name: "Porkbun", category: "hosting", color: "#EF7878", icon: "porkbun", url: "https://porkbun.com", cycle: yearly, aliases: ["domain", "域名"] },
  { id: "godaddy", name: "GoDaddy", category: "hosting", color: "#1BDBDB", icon: "godaddy", url: "https://www.godaddy.com", cycle: yearly, aliases: ["domain", "域名"] },

  // Design
  { id: "figma", name: "Figma", category: "design", color: "#F24E1E", icon: "figma", url: "https://www.figma.com" },
  { id: "adobe-cc", name: "Adobe Creative Cloud", category: "design", color: "#DA1F26", url: "https://www.adobe.com/creativecloud.html", cancelUrl: "https://account.adobe.com/plans", aliases: ["photoshop", "ps", "lightroom"] },
  { id: "canva", name: "Canva Pro", category: "design", color: "#00C4CC", url: "https://www.canva.com" },

  // Security & VPN
  { id: "1password", name: "1Password", category: "security", color: "#3B66BC", icon: "1password", url: "https://1password.com", cycle: yearly },
  { id: "bitwarden", name: "Bitwarden", category: "security", color: "#175DDC", icon: "bitwarden", url: "https://bitwarden.com", cycle: yearly },
  { id: "nordvpn", name: "NordVPN", category: "security", color: "#4687FF", icon: "nordvpn", url: "https://nordvpn.com" },
  { id: "expressvpn", name: "ExpressVPN", category: "security", color: "#DA3940", icon: "expressvpn", url: "https://www.expressvpn.com" },
  { id: "surfshark", name: "Surfshark", category: "security", color: "#1EBFBF", icon: "surfshark", url: "https://surfshark.com" },
  { id: "proton", name: "Proton", category: "security", color: "#6D4AFF", icon: "proton", url: "https://proton.me", aliases: ["protonmail", "protonvpn"] },

  // Gaming
  { id: "playstation-plus", name: "PlayStation Plus", category: "gaming", color: "#0070D1", icon: "playstation", url: "https://www.playstation.com/ps-plus/" },
  { id: "xbox-game-pass", name: "Xbox Game Pass", category: "gaming", color: "#107C10", url: "https://www.xbox.com/xbox-game-pass", cancelUrl: "https://account.microsoft.com/services" },
  { id: "nintendo-online", name: "Nintendo Switch Online", category: "gaming", color: "#E60012", url: "https://www.nintendo.com/switch/online/", cycle: yearly },
  { id: "steam", name: "Steam", category: "gaming", color: "#000000", icon: "steam", url: "https://store.steampowered.com" },
  { id: "ubisoft-plus", name: "Ubisoft+", category: "gaming", color: "#000000", icon: "ubisoft", url: "https://www.ubisoft.com/ubisoft-plus" },

  // Reading & news
  { id: "medium", name: "Medium", category: "reading", color: "#000000", icon: "medium", url: "https://medium.com" },
  { id: "substack", name: "Substack", category: "reading", color: "#FF6719", icon: "substack", url: "https://substack.com" },
  { id: "kindle-unlimited", name: "Kindle Unlimited", category: "reading", color: "#FF9900", url: "https://www.amazon.com/kindle-dbs/hz/subscribe/ku" },
  { id: "weread", name: "WeRead", zh: "微信读书", category: "reading", color: "#1A6DFF", url: "https://weread.qq.com", aliases: ["微信读书"], cn: true },
  { id: "zhihu", name: "Zhihu Salt", zh: "知乎盐选会员", category: "reading", color: "#1772F6", icon: "zhihu", url: "https://www.zhihu.com", aliases: ["知乎", "盐选"], cn: true },
  { id: "patreon", name: "Patreon", category: "reading", color: "#000000", icon: "patreon", url: "https://www.patreon.com" },

  // Learning
  { id: "duolingo", name: "Duolingo Super", category: "learning", color: "#58CC02", icon: "duolingo", url: "https://www.duolingo.com", aliases: ["多邻国"] },
  { id: "coursera", name: "Coursera Plus", category: "learning", color: "#0056D2", icon: "coursera", url: "https://www.coursera.org" },
  { id: "geektime", name: "GeekTime", zh: "极客时间", category: "learning", color: "#FA8919", url: "https://time.geekbang.org", aliases: ["极客时间"], cn: true },

  // Social
  { id: "x-premium", name: "X Premium", category: "social", color: "#000000", icon: "x", url: "https://x.com", aliases: ["twitter"] },
  { id: "telegram-premium", name: "Telegram Premium", category: "social", color: "#26A5E4", icon: "telegram", url: "https://telegram.org" },
  { id: "discord-nitro", name: "Discord Nitro", category: "social", color: "#5865F2", icon: "discord", url: "https://discord.com/nitro" },
  { id: "xiaohongshu", name: "Xiaohongshu", zh: "小红书", category: "social", color: "#FF2442", icon: "xiaohongshu", url: "https://www.xiaohongshu.com", cn: true },

  // Fitness
  { id: "strava", name: "Strava", category: "fitness", color: "#FC4C02", icon: "strava", url: "https://www.strava.com" },
  { id: "keep", name: "Keep 会员", category: "fitness", color: "#584F60", url: "https://www.gotokeep.com", aliases: ["keep"], cn: true },
  { id: "headspace", name: "Headspace", category: "fitness", color: "#F47D31", icon: "headspace", url: "https://www.headspace.com" },
  { id: "gym", name: "Gym membership", zh: "健身房会员", category: "fitness", color: "#F59E0B", url: "", aliases: ["健身", "gym"] },
];

const byId = new Map(SERVICES.map((s) => [s.id, s]));

export function getService(id: string | null | undefined): CatalogService | undefined {
  return id ? byId.get(id) : undefined;
}

/** `icon` value stored on a subscription created from a preset. */
export const SERVICE_ICON_PREFIX = "service:";

export function serviceIdOfIcon(icon: string | null | undefined): string | null {
  return icon?.startsWith(SERVICE_ICON_PREFIX) ? icon.slice(SERVICE_ICON_PREFIX.length) : null;
}

export function displayName(service: CatalogService, locale: string): string {
  return locale.startsWith("zh") && service.zh ? service.zh : service.name;
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/[\s+._-]/g, "");
}

/** Ranked search over names, aliases and domains. Empty query returns the popular list. */
export function searchServices(query: string, locale: string, limit = 24): CatalogService[] {
  const zh = locale.startsWith("zh");
  const q = normalise(query);
  if (!q) {
    const popular = zh
      ? ["chatgpt", "netflix", "icloud", "bilibili", "spotify", "baidu-netdisk", "youtube-premium", "github-copilot", "netease-music", "claude", "iqiyi", "siyuan-sync"]
      : ["netflix", "spotify", "chatgpt", "youtube-premium", "icloud", "disney-plus", "claude", "github-copilot", "apple-music", "prime-video", "notion", "1password"];
    return popular.map((id) => byId.get(id)!).filter(Boolean);
  }
  const scored: { s: CatalogService; score: number }[] = [];
  for (const s of SERVICES) {
    const names = [s.name, s.zh ?? "", ...(s.aliases ?? []), s.url.replace(/^https?:\/\/(www\.)?/, "")].map(normalise);
    let score = 0;
    for (const n of names) {
      if (!n) continue;
      if (n === q) score = Math.max(score, 100);
      else if (n.startsWith(q)) score = Math.max(score, 60);
      else if (n.includes(q)) score = Math.max(score, 30);
    }
    if (score > 0) scored.push({ s, score: score + (zh && s.cn ? 5 : 0) });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.s);
}
