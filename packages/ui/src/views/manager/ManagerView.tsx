import type { Subscription } from "@still/core";
import { CalendarDaysIcon, ChartPieIcon, ListIcon, PlusIcon, Settings2Icon } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button.js";
import { Card } from "../../components/ui/card.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs.js";
import { useI18n, useStill } from "../../context.js";
import { cn } from "../../lib/utils.js";
import { MoneyList } from "../MoneyList.js";
import { PendingSection } from "../PendingSection.js";
import { SettingsView } from "../settings/SettingsView.js";
import { StatusState } from "../StatusState.js";
import { SubscriptionDialog } from "../SubscriptionDialog.js";
import { useTotals } from "../useDerived.js";
import { CalendarView } from "./CalendarView.js";
import { InsightsView } from "./InsightsView.js";
import { SubscriptionList } from "./SubscriptionList.js";

export type ManagerTab = "list" | "calendar" | "insights" | "settings";

/** Full-page view: totals, every subscription, calendar, insights and settings. */
export function ManagerView({ initialTab = "list" }: { initialTab?: ManagerTab }) {
  const { t } = useI18n();
  const status = useStill((s) => s.status);
  const totals = useTotals();
  const [tab, setTab] = useState<ManagerTab>(initialTab);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [open, setOpen] = useState(false);

  const openEditor = (sub: Subscription | null) => {
    setEditing(sub);
    setOpen(true);
  };

  return (
    <div className="still-panel still:min-h-full still:@container">
      <div className="still:mx-auto still:flex still:w-full still:max-w-5xl still:flex-col still:gap-5 still:p-4 still:@2xl:p-8">
        <header className="still:flex still:flex-wrap still:items-end still:justify-between still:gap-3">
          <div>
            <h1 className="still:font-display still:text-2xl still:font-semibold still:tracking-tight">{t("appName")}</h1>
            <p className="still:text-sm still:text-muted-foreground">{t("tagline")}</p>
          </div>
          <Button onClick={() => openEditor(null)} disabled={status !== "ready"}>
            <PlusIcon />
            {t("addSubscription")}
          </Button>
        </header>

        <StatusState rows={4} />

        {status === "ready" && (
          <>
            <div className="still:grid still:grid-cols-2 still:gap-3 still:@3xl:grid-cols-4">
              <Stat label={t("monthlyAverage")} highlight>
                <MoneyList totals={totals.monthly} className="still:text-xl" />
              </Stat>
              <Stat label={t("yearlyEstimate")}>
                <MoneyList totals={totals.yearly} className="still:text-xl" />
              </Stat>
              <Stat label={t("dueIn30Days")} hint={t("stats.charges", { n: totals.next30Count })}>
                <MoneyList totals={totals.next30Days} className="still:text-xl" />
              </Stat>
              <Stat
                label={t("stats.saved")}
                hint={totals.saved.cancelled ? t("stats.savedHint", { n: totals.saved.cancelled }) : t("stats.savedNone")}
              >
                <MoneyList totals={totals.saved.totals} className="still:text-xl still:text-success" />
              </Stat>
            </div>

            <PendingSection className="still:@2xl:max-w-xl" />

            <Tabs value={tab} onValueChange={(v) => setTab(v as ManagerTab)} className="still:flex still:flex-col still:gap-4">
              <TabsList className="still:self-start still:max-w-full still:overflow-x-auto">
                <TabsTrigger value="list"><ListIcon />{t("manager.tab.list")}</TabsTrigger>
                <TabsTrigger value="calendar"><CalendarDaysIcon />{t("manager.tab.calendar")}</TabsTrigger>
                <TabsTrigger value="insights"><ChartPieIcon />{t("manager.tab.insights")}</TabsTrigger>
                <TabsTrigger value="settings"><Settings2Icon />{t("manager.tab.settings")}</TabsTrigger>
              </TabsList>
              <TabsContent value="list"><SubscriptionList onEdit={openEditor} /></TabsContent>
              <TabsContent value="calendar"><CalendarView onEdit={openEditor} /></TabsContent>
              <TabsContent value="insights"><InsightsView onEdit={openEditor} /></TabsContent>
              <TabsContent value="settings"><SettingsView /></TabsContent>
            </Tabs>
          </>
        )}
      </div>
      <SubscriptionDialog open={open} onOpenChange={setOpen} subscription={editing} />
    </div>
  );
}

function Stat({ label, hint, highlight, children }: { label: string; hint?: string; highlight?: boolean; children: React.ReactNode }) {
  return (
    <Card className={cn("still:gap-1 still:p-4", highlight && "still:border-primary/30")}>
      <div className="still:text-xs still:text-muted-foreground">{label}</div>
      <div className="still:font-semibold still:leading-tight">{children}</div>
      {hint && <div className="still:mt-auto still:pt-1 still:text-xs still:text-muted-foreground">{hint}</div>}
    </Card>
  );
}
