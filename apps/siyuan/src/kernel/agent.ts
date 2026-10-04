/**
 * Exposes Still's data to SiYuan's built-in AI agent as a read-only tool, so
 * questions like "what renews this week?" can be answered from real data.
 */
import { formatMoneyPlain, localDateOf, monthlyTotals, upcomingCharges, type StillRepository } from "@still/core";

const NAME = "subscriptions";

function t(key: string): string {
  return ((siyuan.plugin.i18n ?? {}) as Record<string, string>)[key] ?? key;
}

export async function registerAgentCapability(repo: () => StillRepository) {
  if (!siyuan.agent?.registerCapability) return; // older SiYuan
  try {
    await siyuan.agent.registerCapability(
      NAME,
      {
        title: t("agent.title"),
        description: t("agent.description"),
        inputSchema: {
          type: "object",
          properties: {
            withinDays: { type: "integer", minimum: 1, maximum: 3660, description: "Only include charges due within this many days (default: all)." },
          },
        },
        effects: { localRead: true },
      },
      async (input) => {
        const today = localDateOf(new Date());
        const subs = await repo().listSubscriptions();
        const within = typeof input.withinDays === "number" ? input.withinDays : Infinity;
        const totals = monthlyTotals(subs, today);
        return {
          today,
          monthlyTotals: Object.fromEntries(Object.entries(totals).map(([c, v]) => [c, formatMoneyPlain({ amount: v, currency: c })])),
          upcoming: upcomingCharges(subs, today)
            .filter((u) => u.daysLeft <= within)
            .map((u) => ({
              name: u.subscription.name,
              price: formatMoneyPlain(u.subscription.price),
              cycle: `${u.subscription.cycle.every} ${u.subscription.cycle.unit}`,
              nextCharge: u.chargeDate,
              daysLeft: u.daysLeft,
              trial: Boolean(u.subscription.trialEndsOn && u.chargeDate === u.subscription.anchorDate),
              category: u.subscription.category,
            })),
          inactive: subs.filter((s) => s.status !== "active").map((s) => ({ name: s.name, status: s.status, endDate: s.endDate })),
        };
      },
    );
  } catch (e) {
    await siyuan.logger.warn("agent capability registration failed", String(e));
  }
}
