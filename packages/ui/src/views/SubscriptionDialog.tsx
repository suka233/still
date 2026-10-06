import {
  CYCLE_UNITS,
  formatMoneyAmount,
  monthlyEquivalent,
  parseMoneyInput,
  type BillingCycle,
  type CycleUnit,
  type Subscription,
  type SubscriptionInput,
  type SubscriptionStatus,
} from "@still/core";
import { ArrowLeftIcon, ChevronDownIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { categoryLabel, isCategoryId } from "../catalog/category.js";
import { CATEGORY_IDS, SERVICE_ICON_PREFIX, displayName, getService, serviceIdOfIcon } from "../catalog/services.js";
import { Button } from "../components/ui/button.js";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog.js";
import { Input } from "../components/ui/input.js";
import { Label } from "../components/ui/label.js";
import { NativeSelect } from "../components/ui/native-select.js";
import { ChipToggleGroup, Segmented } from "../components/ui/segmented.js";
import { Switch } from "../components/ui/switch.js";
import { Textarea } from "../components/ui/textarea.js";
import { toast } from "../components/ui/toaster.js";
import { useHost, useI18n, useStill } from "../context.js";
import { COMMON_CURRENCIES, formatMoney } from "../format.js";
import { cn } from "../lib/utils.js";
import { parseRpcErrors } from "./errors.js";
import { ServicePicker, type PickResult } from "./ServicePicker.js";
import { SubscriptionAvatar } from "./SubscriptionAvatar.js";

type CyclePreset = "month" | "quarter" | "year" | "week" | "custom";

const PRESET_CYCLES: Record<Exclude<CyclePreset, "custom">, BillingCycle> = {
  month: { unit: "month", every: 1 },
  quarter: { unit: "month", every: 3 },
  year: { unit: "year", every: 1 },
  week: { unit: "week", every: 1 },
};

function presetOf(cycle: BillingCycle): CyclePreset {
  for (const [key, c] of Object.entries(PRESET_CYCLES)) {
    if (c.unit === cycle.unit && c.every === cycle.every) return key as CyclePreset;
  }
  return "custom";
}

const REMIND_OPTIONS = [0, 1, 3, 7, 14, 30];

interface FormState {
  name: string;
  icon: string;
  price: string;
  currency: string;
  preset: CyclePreset;
  every: string;
  unit: CycleUnit;
  anchorDate: string;
  isTrial: boolean;
  useDefaultRemind: boolean;
  remindDays: number[];
  status: SubscriptionStatus;
  category: string;
  url: string;
  cancelUrl: string;
  note: string;
}

function blankState(defaults: { currency: string; today: string; remind: number[] }): FormState {
  return {
    name: "",
    icon: "",
    price: "",
    currency: defaults.currency,
    preset: "month",
    every: "1",
    unit: "month",
    anchorDate: defaults.today,
    isTrial: false,
    useDefaultRemind: true,
    remindDays: defaults.remind,
    status: "active",
    category: "",
    url: "",
    cancelUrl: "",
    note: "",
  };
}

function stateFromSubscription(sub: Subscription, remind: number[]): FormState {
  return {
    name: sub.name,
    icon: sub.icon ?? "",
    price: formatMoneyAmount(sub.price),
    currency: sub.price.currency,
    preset: presetOf(sub.cycle),
    every: String(sub.cycle.every),
    unit: sub.cycle.unit,
    anchorDate: sub.anchorDate,
    isTrial: Boolean(sub.trialEndsOn),
    useDefaultRemind: !sub.remindDaysBefore,
    remindDays: sub.remindDaysBefore ?? remind,
    status: sub.status,
    category: sub.category ?? "",
    url: sub.url ?? "",
    cancelUrl: sub.cancelUrl ?? "",
    note: sub.note ?? "",
  };
}

export interface SubscriptionDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** `null` creates a new subscription (starting with the service picker). */
  subscription: Subscription | null;
  /** Skip the picker and start from this preset (new subscriptions only). */
  initialPick?: PickResult | null;
}

export function SubscriptionDialog({ open, onOpenChange, subscription, initialPick }: SubscriptionDialogProps) {
  const { t, locale } = useI18n();
  const settings = useStill((s) => s.settings);
  const today = useStill((s) => s.today);
  const defaults = { currency: settings.defaultCurrency, today, remind: settings.remindDaysBefore };
  const [step, setStep] = useState<"pick" | "form">(subscription ? "form" : "pick");
  const [form, setForm] = useState<FormState>(() => (subscription ? stateFromSubscription(subscription, defaults.remind) : blankState(defaults)));

  useEffect(() => {
    if (!open) return;
    setStep(subscription ? "form" : "pick");
    setForm(subscription ? stateFromSubscription(subscription, settings.remindDaysBefore) : blankState(defaults));
    if (!subscription && initialPick) onPick(initialPick);
    // Deps on purpose: reset only when the dialog opens or its target changes, not on settings edits.
  }, [open, subscription, initialPick]);

  function onPick(result: PickResult) {
    const base = blankState(defaults);
    if (result.kind === "service") {
      const s = result.service;
      const cycle = s.cycle ?? PRESET_CYCLES.month;
      setForm({
        ...base,
        name: displayName(s, locale),
        icon: SERVICE_ICON_PREFIX + s.id,
        preset: presetOf(cycle),
        every: String(cycle.every),
        unit: cycle.unit,
        category: s.category,
        url: s.url,
        cancelUrl: s.cancelUrl ?? "",
      });
    } else {
      setForm({ ...base, name: result.name });
    }
    setStep("form");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="still:max-w-lg" onOpenAutoFocus={(e) => step === "form" && e.preventDefault()}>
        {step === "pick" ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("picker.title")}</DialogTitle>
              <DialogDescription className="still:sr-only">{t("addSubscription")}</DialogDescription>
            </DialogHeader>
            <ServicePicker onPick={onPick} />
          </>
        ) : (
          <SubscriptionForm
            form={form}
            setForm={setForm}
            subscription={subscription}
            onBack={subscription ? undefined : () => setStep("pick")}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SubscriptionForm({
  form,
  setForm,
  subscription,
  onBack,
  onDone,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  subscription: Subscription | null;
  onBack?: () => void;
  onDone(): void;
}) {
  const { t, locale } = useI18n();
  const host = useHost();
  const settings = useStill((s) => s.settings);
  const create = useStill((s) => s.create);
  const update = useStill((s) => s.update);
  const remove = useStill((s) => s.remove);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(Boolean(subscription && (subscription.note || subscription.cancelUrl || subscription.remindDaysBefore)));
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();
  const priceRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Presets already know the name; jump straight to the price.
    (form.name ? priceRef : nameRef).current?.focus();
    // Deps on purpose: focus once, when the form first appears.
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const cycle: BillingCycle = form.preset === "custom" ? { unit: form.unit, every: Math.max(1, Number(form.every) || 1) } : PRESET_CYCLES[form.preset];
  const parsedPrice = parseMoneyInput(form.price, form.currency);
  const currencies = COMMON_CURRENCIES.includes(form.currency) ? COMMON_CURRENCIES : [form.currency, ...COMMON_CURRENCIES];
  const service = getService(serviceIdOfIcon(form.icon));
  const categoryOptions = form.category && !isCategoryId(form.category) ? [form.category, ...CATEGORY_IDS] : CATEGORY_IDS;

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const nextErrors: string[] = [];
    if (!parsedPrice) nextErrors.push(t("error.price"));
    if (!form.useDefaultRemind && form.remindDays.length === 0) nextErrors.push(t("error.remindDays"));
    if (nextErrors.length || !parsedPrice) {
      setErrors(nextErrors);
      return;
    }
    const input: SubscriptionInput = {
      name: form.name,
      status: form.status,
      price: parsedPrice,
      cycle,
      anchorDate: form.anchorDate,
      trialEndsOn: form.isTrial ? form.anchorDate : null,
      endDate: form.status === "cancelled" ? subscription?.endDate ?? null : null,
      remindDaysBefore: form.useDefaultRemind ? null : form.remindDays,
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
      if (subscription) {
        await update(subscription.id, input);
        toast(t("toast.saved"));
      } else {
        const created = await create(input);
        toast(t("toast.created", { name: created.name }));
      }
      onDone();
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
      toast(t("toast.deleted", { name: subscription.name }));
      onDone();
    } catch (e) {
      setErrors(parseRpcErrors(e));
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  }

  const monthly = parsedPrice && form.preset !== "month" ? Math.round(monthlyEquivalent(parsedPrice.amount, cycle)) : null;

  return (
    <form ref={formRef} onSubmit={submit} onKeyDown={onKeyDown} className="still:grid still:gap-4">
      <DialogHeader className="still:flex-row still:items-center still:gap-3">
        {onBack && (
          <Button type="button" variant="ghost" size="icon-sm" onClick={onBack} aria-label={t("form.back")} className="still:-ml-1">
            <ArrowLeftIcon />
          </Button>
        )}
        <SubscriptionAvatar subscription={{ icon: form.icon || null, name: form.name || "?" }} className="still:size-10 still:text-base" />
        <div className="still:min-w-0 still:flex-1">
          <DialogTitle className="still:sr-only">{subscription ? t("editSubscription") : t("addSubscription")}</DialogTitle>
          <DialogDescription className="still:sr-only">{t("tagline")}</DialogDescription>
          <input
            ref={nameRef}
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={t("field.namePlaceholder")}
            aria-label={t("field.name")}
            className="still:w-full still:min-w-0 still:bg-transparent still:text-lg still:font-semibold still:outline-none still:placeholder:font-normal still:placeholder:text-muted-foreground"
          />
          {service && <div className="still:text-xs still:text-muted-foreground">{categoryLabel(service.category, t)}</div>}
        </div>
      </DialogHeader>

      <div className="still:grid still:gap-1.5">
        <Label htmlFor={`${id}-price`}>{t("field.price")}</Label>
        <div className="still:flex still:gap-2">
          <NativeSelect aria-label={t("field.currency")} value={form.currency} onChange={(e) => set("currency", e.target.value)} className="still:w-24">
            {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
          </NativeSelect>
          <Input
            ref={priceRef}
            id={`${id}-price`}
            required
            inputMode="decimal"
            value={form.price}
            placeholder={t("form.pricePlaceholder")}
            onChange={(e) => set("price", e.target.value)}
            aria-invalid={form.price !== "" && !parsedPrice}
            className="still-amount still:text-base"
          />
        </div>
        {monthly !== null && (
          <p className="still:text-xs still:text-muted-foreground">{t("form.preview", { amount: formatMoney({ amount: monthly, currency: form.currency }, locale) })}</p>
        )}
      </div>

      <div className="still:grid still:gap-1.5">
        <Label>{t("form.cycle")}</Label>
        <Segmented
          aria-label={t("form.cycle")}
          value={form.preset}
          onChange={(v) => set("preset", v)}
          options={(["month", "quarter", "year", "week", "custom"] as const).map((v) => ({ value: v, label: t(`cycle.preset.${v}`) }))}
        />
        {form.preset === "custom" && (
          <div className="still:flex still:items-center still:gap-2 still:animate-in still:fade-in-0">
            <span className="still:text-sm still:text-muted-foreground">{t("field.every")}</span>
            <Input type="number" min={1} max={1000} value={form.every} onChange={(e) => set("every", e.target.value)} className="still:w-20" aria-label={t("field.every")} />
            <NativeSelect value={form.unit} onChange={(e) => set("unit", e.target.value as CycleUnit)} className="still:w-28" aria-label={t("field.unit")}>
              {CYCLE_UNITS.map((u) => <option key={u} value={u}>{t(`unit.${u}`)}</option>)}
            </NativeSelect>
          </div>
        )}
      </div>

      <div className="still:grid still:gap-1.5">
        <div className="still:flex still:items-center still:justify-between still:gap-2">
          <Label htmlFor={`${id}-anchor`}>{form.isTrial ? t("form.trialAnchor") : t("field.anchorDate")}</Label>
          <label className="still:flex still:cursor-pointer still:items-center still:gap-2 still:text-xs still:text-muted-foreground">
            <Switch checked={form.isTrial} onCheckedChange={(v) => set("isTrial", v)} aria-label={t("trial")} />
            {t("trial")}
          </label>
        </div>
        <Input id={`${id}-anchor`} type="date" required value={form.anchorDate} onChange={(e) => set("anchorDate", e.target.value)} />
        <p className="still:text-xs still:text-muted-foreground">{t("form.anchorHint")}</p>
      </div>

      {subscription && (
        <div className="still:grid still:gap-1.5">
          <Label>{t("field.status")}</Label>
          <Segmented
            size="sm"
            value={form.status}
            onChange={(v) => set("status", v)}
            options={(["active", "paused", "cancelled"] as const).map((v) => ({ value: v, label: t(`status.${v}`) }))}
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => setMore((m) => !m)}
        aria-expanded={more}
        className="still:flex still:items-center still:gap-1 still:justify-self-start still:text-sm still:font-medium still:text-muted-foreground still:hover:text-foreground"
      >
        <ChevronDownIcon className={cn("still:size-4 still:transition-transform", more && "still:rotate-180")} />
        {more ? t("form.less") : t("form.more")}
      </button>

      {more && (
        <div className="still:grid still:gap-4 still:animate-in still:fade-in-0 still:slide-in-from-top-1">
          <div className="still:grid still:gap-1.5">
            <div className="still:flex still:items-center still:justify-between">
              <Label>{t("field.remindDaysBefore")}</Label>
              <label className="still:flex still:cursor-pointer still:items-center still:gap-2 still:text-xs still:text-muted-foreground">
                <Switch checked={form.useDefaultRemind} onCheckedChange={(v) => set("useDefaultRemind", v)} aria-label={t("form.useDefault")} />
                {t("form.useDefault")} ({settings.remindDaysBefore.join(", ")})
              </label>
            </div>
            {!form.useDefaultRemind && (
              <ChipToggleGroup
                values={form.remindDays}
                onChange={(v) => set("remindDays", v)}
                options={REMIND_OPTIONS.map((n) => ({ value: n, label: n === 0 ? t("form.remindDay0") : t("form.remindDayN", { n }) }))}
              />
            )}
          </div>
          <div className="still:grid still:grid-cols-[1fr_5.5rem] still:gap-2">
            <Field label={t("field.category")} htmlFor={`${id}-category`}>
              <NativeSelect id={`${id}-category`} value={form.category} onChange={(e) => set("category", e.target.value)}>
                <option value="">{t("category.none")}</option>
                {categoryOptions.map((c) => <option key={c} value={c}>{categoryLabel(c, t)}</option>)}
              </NativeSelect>
            </Field>
            <Field label={t("field.icon")} htmlFor={`${id}-icon`}>
              <Input
                id={`${id}-icon`}
                value={service ? "" : form.icon}
                placeholder={service ? "✓" : "🎬"}
                maxLength={8}
                onChange={(e) => set("icon", e.target.value)}
              />
            </Field>
          </div>
          <div className="still:grid still:grid-cols-2 still:gap-2">
            <Field label={t("field.url")} htmlFor={`${id}-url`}>
              <Input id={`${id}-url`} type="url" value={form.url} placeholder="https://" onChange={(e) => set("url", e.target.value)} />
            </Field>
            <Field label={t("field.cancelUrl")} htmlFor={`${id}-cancel`}>
              <Input id={`${id}-cancel`} type="url" value={form.cancelUrl} placeholder="https://" onChange={(e) => set("cancelUrl", e.target.value)} />
            </Field>
          </div>
          <Field label={t("field.note")} htmlFor={`${id}-note`}>
            <Textarea id={`${id}-note`} rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} />
          </Field>
        </div>
      )}

      {errors.length > 0 && (
        <ul role="alert" className="still:rounded-md still:bg-destructive/10 still:px-3 still:py-2 still:text-sm still:text-destructive">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <DialogFooter className="still:items-center still:pt-1">
        {subscription ? (
          <Button type="button" variant="ghost" className="still:mr-auto still:text-destructive" disabled={busy} onClick={onDelete}>
            {t("delete")}
          </Button>
        ) : (
          <span className="still:mr-auto still:hidden still:text-xs still:text-muted-foreground still:sm:inline">{t("form.submitHint")}</span>
        )}
        <Button type="button" variant="outline" disabled={busy} onClick={onDone}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={busy}>
          {t("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="still:grid still:gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
