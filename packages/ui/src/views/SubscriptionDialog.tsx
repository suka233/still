import {
  CYCLE_UNITS,
  formatMoneyAmount,
  parseMoneyInput,
  type CycleUnit,
  type Subscription,
  type SubscriptionInput,
  type SubscriptionStatus,
} from "@still/core";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../components/ui/button.js";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog.js";
import { Input } from "../components/ui/input.js";
import { Label } from "../components/ui/label.js";
import { NativeSelect } from "../components/ui/native-select.js";
import { Textarea } from "../components/ui/textarea.js";
import { useHost, useI18n, useStill } from "../context.js";
import { COMMON_CURRENCIES } from "../format.js";
import { parseRpcErrors } from "./errors.js";

interface FormState {
  name: string;
  price: string;
  currency: string;
  every: string;
  unit: CycleUnit;
  anchorDate: string;
  isTrial: boolean;
  remindDays: string;
  status: SubscriptionStatus;
  category: string;
  url: string;
  cancelUrl: string;
  icon: string;
  note: string;
}

function initialState(sub: Subscription | null, defaults: { currency: string; today: string }): FormState {
  if (!sub) {
    return {
      name: "", price: "", currency: defaults.currency, every: "1", unit: "month", anchorDate: defaults.today,
      isTrial: false, remindDays: "", status: "active", category: "", url: "", cancelUrl: "", icon: "", note: "",
    };
  }
  return {
    name: sub.name,
    price: formatMoneyAmount(sub.price),
    currency: sub.price.currency,
    every: String(sub.cycle.every),
    unit: sub.cycle.unit,
    anchorDate: sub.anchorDate,
    isTrial: Boolean(sub.trialEndsOn),
    remindDays: sub.remindDaysBefore?.join(", ") ?? "",
    status: sub.status,
    category: sub.category ?? "",
    url: sub.url ?? "",
    cancelUrl: sub.cancelUrl ?? "",
    icon: sub.icon ?? "",
    note: sub.note ?? "",
  };
}

function parseDays(text: string): number[] | null | "invalid" {
  if (!text.trim()) return null;
  const parts = text.split(/[,，\s]+/).filter(Boolean);
  const days = parts.map(Number);
  return days.every((d) => Number.isInteger(d) && d >= 0 && d <= 365) ? days : "invalid";
}

export interface SubscriptionDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** `null` creates a new subscription. */
  subscription: Subscription | null;
}

export function SubscriptionDialog({ open, onOpenChange, subscription }: SubscriptionDialogProps) {
  const { t } = useI18n();
  const host = useHost();
  const settings = useStill((s) => s.settings);
  const today = useStill((s) => s.today);
  const create = useStill((s) => s.create);
  const update = useStill((s) => s.update);
  const remove = useStill((s) => s.remove);

  const [form, setForm] = useState(() => initialState(subscription, { currency: settings.defaultCurrency, today }));
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initialState(subscription, { currency: settings.defaultCurrency, today }));
      setErrors([]);
    }
  }, [open, subscription, settings.defaultCurrency, today]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const currencies = COMMON_CURRENCIES.includes(form.currency) ? COMMON_CURRENCIES : [form.currency, ...COMMON_CURRENCIES];

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: string[] = [];
    const price = parseMoneyInput(form.price, form.currency);
    if (!price) nextErrors.push(t("error.price"));
    const remindDaysBefore = parseDays(form.remindDays);
    if (remindDaysBefore === "invalid") nextErrors.push(t("error.remindDays"));
    if (nextErrors.length || !price || remindDaysBefore === "invalid") {
      setErrors(nextErrors);
      return;
    }
    const input: SubscriptionInput = {
      name: form.name,
      status: form.status,
      price,
      cycle: { unit: form.unit, every: Number(form.every) || 1 },
      anchorDate: form.anchorDate,
      trialEndsOn: form.isTrial ? form.anchorDate : null,
      endDate: subscription?.endDate ?? null,
      remindDaysBefore,
      category: form.category || null,
      tags: subscription?.tags ?? [],
      url: form.url || null,
      cancelUrl: form.cancelUrl || null,
      icon: form.icon || null,
      note: form.note || null,
      noteRef: subscription?.noteRef ?? null,
    };
    setBusy(true);
    try {
      if (subscription) await update(subscription.id, input);
      else await create(input);
      onOpenChange(false);
    } catch (e) {
      setErrors(parseRpcErrors(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!subscription) return;
    if (!(await host.confirm(t("confirmDelete", { name: subscription.name })))) return;
    setBusy(true);
    try {
      await remove(subscription.id);
      onOpenChange(false);
    } catch (e) {
      setErrors(parseRpcErrors(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{subscription ? t("editSubscription") : t("addSubscription")}</DialogTitle>
          <DialogDescription className="still:sr-only">{t("tagline")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="still:grid still:gap-3">
          <div className="still:grid still:grid-cols-[1fr_5rem] still:gap-2">
            <Field label={t("field.name")} htmlFor="still-name">
              <Input id="still-name" required autoFocus value={form.name} placeholder={t("field.namePlaceholder")} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label={t("field.icon")} htmlFor="still-icon">
              <Input id="still-icon" value={form.icon} maxLength={8} placeholder="🎬" onChange={(e) => set("icon", e.target.value)} />
            </Field>
          </div>
          <div className="still:grid still:grid-cols-[1fr_7rem] still:gap-2">
            <Field label={t("field.price")} htmlFor="still-price">
              <Input id="still-price" required inputMode="decimal" value={form.price} placeholder="9.99" onChange={(e) => set("price", e.target.value)} />
            </Field>
            <Field label={t("field.currency")} htmlFor="still-currency">
              <NativeSelect id="still-currency" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </NativeSelect>
            </Field>
          </div>
          <div className="still:grid still:grid-cols-[5rem_1fr_1fr] still:gap-2">
            <Field label={t("field.every")} htmlFor="still-every">
              <Input id="still-every" type="number" min={1} max={1000} required value={form.every} onChange={(e) => set("every", e.target.value)} />
            </Field>
            <Field label={t("field.unit")} htmlFor="still-unit">
              <NativeSelect id="still-unit" value={form.unit} onChange={(e) => set("unit", e.target.value as CycleUnit)}>
                {CYCLE_UNITS.map((u) => <option key={u} value={u}>{t(`unit.${u}`)}</option>)}
              </NativeSelect>
            </Field>
            <Field label={t("field.status")} htmlFor="still-status">
              <NativeSelect id="still-status" value={form.status} onChange={(e) => set("status", e.target.value as SubscriptionStatus)}>
                <option value="active">{t("status.active")}</option>
                <option value="paused">{t("status.paused")}</option>
                <option value="cancelled">{t("status.cancelled")}</option>
              </NativeSelect>
            </Field>
          </div>
          <Field label={t("field.anchorDate")} htmlFor="still-anchor">
            <Input id="still-anchor" type="date" required value={form.anchorDate} onChange={(e) => set("anchorDate", e.target.value)} />
          </Field>
          <label className="still:flex still:items-center still:gap-2 still:text-sm">
            <input type="checkbox" checked={form.isTrial} onChange={(e) => set("isTrial", e.target.checked)} />
            {t("field.isTrial")}
          </label>
          <Field label={t("field.remindDaysBefore")} htmlFor="still-remind" hint={t("field.remindHint", { days: settings.remindDaysBefore.join(", ") })}>
            <Input id="still-remind" value={form.remindDays} placeholder={settings.remindDaysBefore.join(", ")} onChange={(e) => set("remindDays", e.target.value)} />
          </Field>
          <div className="still:grid still:grid-cols-2 still:gap-2">
            <Field label={t("field.url")} htmlFor="still-url">
              <Input id="still-url" type="url" value={form.url} placeholder="https://" onChange={(e) => set("url", e.target.value)} />
            </Field>
            <Field label={t("field.cancelUrl")} htmlFor="still-cancel-url">
              <Input id="still-cancel-url" type="url" value={form.cancelUrl} placeholder="https://" onChange={(e) => set("cancelUrl", e.target.value)} />
            </Field>
          </div>
          <Field label={t("field.category")} htmlFor="still-category">
            <Input id="still-category" value={form.category} onChange={(e) => set("category", e.target.value)} />
          </Field>
          <Field label={t("field.note")} htmlFor="still-note">
            <Textarea id="still-note" rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} />
          </Field>

          {errors.length > 0 && (
            <ul role="alert" className="still:rounded-md still:bg-destructive/10 still:px-3 still:py-2 still:text-sm still:text-destructive">
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}

          <DialogFooter className="still:pt-1">
            {subscription && (
              <Button type="button" variant="ghost" className="still:mr-auto still:text-destructive" disabled={busy} onClick={onDelete}>
                {t("delete")}
              </Button>
            )}
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="still:grid still:gap-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="still:text-xs still:text-muted-foreground">{hint}</p>}
    </div>
  );
}
