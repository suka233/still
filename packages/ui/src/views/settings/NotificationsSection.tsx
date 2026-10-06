import { CHANNEL_FIELDS, CHANNEL_KINDS, randomUuid, type Channel, type ChannelKind, type NotificationSettings } from "@still/core";
import { BellRingIcon, PencilIcon, PlusIcon, SendIcon, Trash2Icon, WebhookIcon } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BRAND_ICON_PATHS } from "../../catalog/icons.generated.js";
import { Button } from "../../components/ui/button.js";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { NativeSelect } from "../../components/ui/native-select.js";
import { Switch } from "../../components/ui/switch.js";
import { toast } from "../../components/ui/toaster.js";
import { useClient, useHost, useI18n } from "../../context.js";
import type { MessageKey } from "../../i18n/index.js";
import { cn } from "../../lib/utils.js";
import { readableOn } from "../../theme.js";
import { parseRpcErrors } from "../errors.js";

const KIND_VISUALS: Record<ChannelKind, { color: string; icon?: string; mono?: string; lucide?: "bell" | "webhook" }> = {
  bark: { color: "#F2564B", lucide: "bell" },
  ntfy: { color: "#317F6F", icon: "ntfy" },
  telegram: { color: "#26A5E4", icon: "telegram" },
  serverchan: { color: "#07C160", icon: "wechat" },
  wecom: { color: "#2F7CF6", mono: "企" },
  dingtalk: { color: "#1677FF", mono: "钉" },
  feishu: { color: "#00B8A9", mono: "飞" },
  discord: { color: "#5865F2", icon: "discord" },
  slack: { color: "#4A154B", mono: "S" },
  gotify: { color: "#0B6FB7", mono: "G" },
  webhook: { color: "#64748B", lucide: "webhook" },
};

function KindIcon({ kind, className }: { kind: ChannelKind; className?: string }) {
  const v = KIND_VISUALS[kind];
  const path = v.icon ? BRAND_ICON_PATHS[v.icon] : undefined;
  return (
    <span
      aria-hidden
      className={cn("still-avatar still:flex still:size-8 still:shrink-0 still:items-center still:justify-center still:text-sm still:font-bold", className)}
      style={{ backgroundColor: v.color, color: readableOn(v.color) }}
    >
      {path ? (
        <svg viewBox="0 0 24 24" className="still:size-[58%]" fill="currentColor"><path d={path} /></svg>
      ) : v.lucide === "bell" ? (
        <BellRingIcon className="still:size-[55%]" />
      ) : v.lucide === "webhook" ? (
        <WebhookIcon className="still:size-[55%]" />
      ) : (
        v.mono
      )}
    </span>
  );
}

/** Push channels (and, where supported, the daily-note option). */
export function NotificationsSection() {
  const { t } = useI18n();
  const client = useClient();
  const host = useHost();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [device, setDevice] = useState<{ deviceId: string; name: string; os: string } | null>(null);
  const [notebooks, setNotebooks] = useState<{ id: string; name: string }[] | null>(null);
  const [editing, setEditing] = useState<Channel | "new" | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    if (!client.getNotifications) return;
    void client.getNotifications().then(setSettings).catch((e: unknown) => toast.error(parseRpcErrors(e).join("\n")));
    void client.deviceInfo?.().then(setDevice).catch(() => undefined);
    void client.listNotebooks?.().then(setNotebooks).catch(() => setNotebooks([]));
  }, [client]);

  const save = useCallback(
    async (next: NotificationSettings) => {
      const previous = settings;
      setSettings(next); // optimistic
      try {
        setSettings(await client.saveNotifications!(next));
        return true;
      } catch (e) {
        setSettings(previous);
        toast.error(parseRpcErrors(e).join("\n"));
        return false;
      }
    },
    [client, settings],
  );

  if (!client.getNotifications || !client.saveNotifications) return null;
  if (!settings) return null;

  async function test(channel: Channel) {
    setTesting(channel.id);
    try {
      const r = await client.testChannel!(channel);
      if (r.ok) toast(t("push.testOk"));
      else toast.error(t("push.testFailed", { status: r.status, error: r.error ?? "" }));
    } catch (e) {
      toast.error(parseRpcErrors(e).join("\n"));
    } finally {
      setTesting(null);
    }
  }

  async function remove(channel: Channel) {
    if (!(await host.confirm(t("push.removeConfirm", { name: channel.name || t(`channel.${channel.kind}`) })))) return;
    await save({ ...settings!, channels: settings!.channels.filter((c) => c.id !== channel.id) });
  }

  function upsert(channel: Channel) {
    const exists = settings!.channels.some((c) => c.id === channel.id);
    const channels = exists ? settings!.channels.map((c) => (c.id === channel.id ? channel : c)) : [...settings!.channels, channel];
    // The first channel defaults to sending from this device, which avoids duplicates.
    const sender = !exists && settings!.channels.length === 0 && device ? device.deviceId : settings!.sender;
    return save({ ...settings!, channels, sender });
  }

  const deviceLabel = device ? device.name || device.os : "";
  const senderOptions = [
    { value: "any", label: t("push.sender.any") },
    ...(device ? [{ value: device.deviceId, label: t("push.sender.this", { name: deviceLabel }) }] : []),
    ...(settings.sender !== "any" && settings.sender !== device?.deviceId ? [{ value: settings.sender, label: t("push.sender.other") }] : []),
  ];

  return (
    <>
      <Card className="still:gap-4 still:p-4">
        <CardHeader>
          <div className="still:flex still:items-start still:justify-between still:gap-3">
            <div className="still:grid still:gap-1">
              <CardTitle className="still:font-display">{t("push.title")}</CardTitle>
              <CardDescription>{t("push.description")}</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
              <PlusIcon />
              {t("push.add")}
            </Button>
          </div>
        </CardHeader>

        {settings.channels.length === 0 ? (
          <p className="still:rounded-lg still:border still:border-dashed still:border-border still:px-3 still:py-4 still:text-center still:text-sm still:text-muted-foreground">{t("push.empty")}</p>
        ) : (
          <ul className="still:flex still:flex-col still:gap-1.5">
            {settings.channels.map((c) => (
              <li key={c.id} className="still:flex still:items-center still:gap-3 still:rounded-lg still:border still:border-border still:px-3 still:py-2">
                <KindIcon kind={c.kind} />
                <div className="still:min-w-0 still:flex-1">
                  <div className="still:truncate still:text-sm still:font-medium">{c.name || t(`channel.${c.kind}`)}</div>
                  {c.name && <div className="still:truncate still:text-xs still:text-muted-foreground">{t(`channel.${c.kind}`)}</div>}
                </div>
                <Button size="sm" variant="ghost" disabled={testing === c.id} onClick={() => void test(c)}>
                  <SendIcon />
                  {testing === c.id ? t("push.testing") : t("push.test")}
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label={t("push.edit")} onClick={() => setEditing(c)}>
                  <PencilIcon />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label={t("push.remove")} onClick={() => void remove(c)}>
                  <Trash2Icon />
                </Button>
                <Switch checked={c.enabled} onCheckedChange={(enabled) => void upsert({ ...c, enabled })} aria-label={c.name || c.kind} />
              </li>
            ))}
          </ul>
        )}

        {settings.channels.length > 0 && (
          <div className="still:grid still:gap-1.5">
            <div className="still:flex still:items-center still:justify-between still:gap-3">
              <span className="still:text-sm">{t("push.sender")}</span>
              <NativeSelect value={settings.sender} onChange={(e) => void save({ ...settings, sender: e.target.value })} className="still:w-auto still:min-w-40" aria-label={t("push.sender")}>
                {senderOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </NativeSelect>
            </div>
            <p className="still:text-xs still:text-muted-foreground">{t("push.senderHint")}</p>
          </div>
        )}
      </Card>

      {(notebooks || client.dailyNotes) && (
        <Card className="still:gap-4 still:p-4">
          <CardHeader>
            <CardTitle className="still:font-display">{t("journal.title")}</CardTitle>
            <CardDescription>{t(client.dailyNotes ? "journal.descriptionDaily" : "journal.description")}</CardDescription>
          </CardHeader>
          <div className="still:flex still:items-center still:justify-between still:gap-3">
            <span className="still:text-sm">{t("journal.enable")}</span>
            <Switch
              checked={settings.journal.enabled}
              onCheckedChange={(enabled) =>
                void save({ ...settings, journal: { enabled, notebookId: settings.journal.notebookId ?? notebooks?.[0]?.id ?? null } })
              }
              aria-label={t("journal.enable")}
            />
          </div>
          {settings.journal.enabled && notebooks && (
            <div className="still:flex still:items-center still:justify-between still:gap-3">
              <span className="still:text-sm">{t("journal.notebook")}</span>
              <NativeSelect
                value={settings.journal.notebookId ?? ""}
                onChange={(e) => void save({ ...settings, journal: { ...settings.journal, notebookId: e.target.value || null } })}
                className="still:w-auto still:min-w-40"
                aria-label={t("journal.notebook")}
              >
                <option value="">{t("journal.pickNotebook")}</option>
                {notebooks.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
              </NativeSelect>
            </div>
          )}
        </Card>
      )}

      <ChannelDialog
        channel={editing === "new" ? null : editing}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        onSave={async (c) => {
          if (await upsert(c)) {
            toast(t("push.saved"));
            setEditing(null);
          }
        }}
        onTest={test}
        testing={testing}
      />
    </>
  );
}

function ChannelDialog({
  channel,
  open,
  onOpenChange,
  onSave,
  onTest,
  testing,
}: {
  channel: Channel | null;
  open: boolean;
  onOpenChange(open: boolean): void;
  onSave(channel: Channel): Promise<void>;
  onTest(channel: Channel): Promise<void>;
  testing: string | null;
}) {
  const { t } = useI18n();
  const [kind, setKind] = useState<ChannelKind | null>(channel?.kind ?? null);
  const [draft, setDraft] = useState<Channel | null>(channel);

  useEffect(() => {
    if (!open) return;
    setKind(channel?.kind ?? null);
    setDraft(channel);
  }, [open, channel]);

  const pick = (k: ChannelKind) => {
    setKind(k);
    setDraft({ id: randomUuid(), kind: k, name: "", enabled: true, config: {} });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="still:max-w-lg">
        {!kind || !draft ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("push.pickKind")}</DialogTitle>
              <DialogDescription className="still:sr-only">{t("push.description")}</DialogDescription>
            </DialogHeader>
            <div className="still:grid still:grid-cols-2 still:gap-1.5">
              {CHANNEL_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => pick(k)}
                  className="still:flex still:items-center still:gap-2.5 still:rounded-lg still:border still:border-border still:px-2.5 still:py-2 still:text-left still:text-sm still:transition-colors still:hover:bg-accent"
                >
                  <KindIcon kind={k} className="still:size-7" />
                  <span className="still:min-w-0 still:leading-snug still:line-clamp-2">{t(`channel.${k}`)}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <form
            className="still:grid still:gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void onSave(draft);
            }}
          >
            <DialogHeader className="still:flex-row still:items-center still:gap-3">
              <KindIcon kind={kind} className="still:size-10" />
              <div className="still:grid still:gap-0.5">
                <DialogTitle>{t(`channel.${kind}`)}</DialogTitle>
                <DialogDescription>{t(`channel.${kind}.help`)}</DialogDescription>
              </div>
            </DialogHeader>
            <Field label={t("push.name")}>
              <Input value={draft.name} placeholder={t("push.namePlaceholder")} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            {CHANNEL_FIELDS[kind].map((f) => (
              <Field key={f.key} label={t(`channelField.${f.key}` as MessageKey)}>
                <Input
                  value={draft.config[f.key] ?? ""}
                  required={!f.optional}
                  type={f.secret ? "password" : f.url ? "url" : "text"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={f.placeholder}
                  onChange={(e) => setDraft({ ...draft, config: { ...draft.config, [f.key]: e.target.value } })}
                />
              </Field>
            ))}
            <DialogFooter>
              <Button type="button" variant="ghost" className="still:mr-auto" disabled={testing === draft.id} onClick={() => void onTest(draft)}>
                <SendIcon />
                {testing === draft.id ? t("push.testing") : t("push.test")}
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit">{t("push.save")}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="still:grid still:gap-1.5">
      <Label asChild>
        <span>{label}</span>
      </Label>
      {children}
    </label>
  );
}
