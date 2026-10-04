import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../components/ui/button.js";
import { Card, CardHeader, CardTitle } from "../components/ui/card.js";
import { Input } from "../components/ui/input.js";
import { Label } from "../components/ui/label.js";
import { NativeSelect } from "../components/ui/native-select.js";
import { useHost, useI18n, useStill } from "../context.js";
import { COMMON_CURRENCIES } from "../format.js";
import { parseRpcErrors } from "./errors.js";

function parseDays(text: string): number[] {
  return text.split(/[,，\s]+/).filter(Boolean).map(Number);
}

export function SettingsCard() {
  const { t } = useI18n();
  const host = useHost();
  const settings = useStill((s) => s.settings);
  const save = useStill((s) => s.saveSettings);
  const [form, setForm] = useState({ currency: "", remind: "", trial: "", notifyAt: "" });
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    setForm({
      currency: settings.defaultCurrency,
      remind: settings.remindDaysBefore.join(", "),
      trial: settings.trialRemindDaysBefore.join(", "),
      notifyAt: settings.notifyAt,
    });
  }, [settings]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await save({
        defaultCurrency: form.currency,
        remindDaysBefore: parseDays(form.remind),
        trialRemindDaysBefore: parseDays(form.trial),
        notifyAt: form.notifyAt,
      });
      setErrors([]);
      host.toast?.(t("saved"));
    } catch (e) {
      setErrors(parseRpcErrors(e));
    }
  }

  const currencies = COMMON_CURRENCIES.includes(form.currency) ? COMMON_CURRENCIES : [form.currency, ...COMMON_CURRENCIES];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings")}</CardTitle>
      </CardHeader>
      <form onSubmit={submit} className="still:grid still:gap-3 still:sm:grid-cols-2">
        <div className="still:grid still:gap-1">
          <Label htmlFor="still-set-currency">{t("settings.defaultCurrency")}</Label>
          <NativeSelect id="still-set-currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
          </NativeSelect>
        </div>
        <div className="still:grid still:gap-1">
          <Label htmlFor="still-set-time">{t("settings.notifyAt")}</Label>
          <Input id="still-set-time" type="time" value={form.notifyAt} onChange={(e) => setForm({ ...form, notifyAt: e.target.value })} />
        </div>
        <div className="still:grid still:gap-1">
          <Label htmlFor="still-set-remind">{t("settings.remindDaysBefore")}</Label>
          <Input id="still-set-remind" value={form.remind} onChange={(e) => setForm({ ...form, remind: e.target.value })} />
        </div>
        <div className="still:grid still:gap-1">
          <Label htmlFor="still-set-trial">{t("settings.trialRemindDaysBefore")}</Label>
          <Input id="still-set-trial" value={form.trial} onChange={(e) => setForm({ ...form, trial: e.target.value })} />
        </div>
        {errors.length > 0 && (
          <ul role="alert" className="still:text-sm still:text-destructive still:sm:col-span-2">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
        <div className="still:flex still:justify-end still:sm:col-span-2">
          <Button type="submit">{t("save")}</Button>
        </div>
      </form>
    </Card>
  );
}
