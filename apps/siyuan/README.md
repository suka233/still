# Still · 续了么

> Before it renews, Still asks: **still using it?**

Still keeps track of your subscriptions and free trials. Before each charge it shows a card — **keep**, **cancel**, or **decide later** — one click.

![Still](https://raw.githubusercontent.com/suka233/still/main/docs/media/preview.png)

## Features

- **Reminders before every charge** — 3 days and 1 day ahead by default, and before free trials convert; same-day reminders wait for your notify time.
- **The "still using it?" card** — what this charge costs and roughly how much you've paid so far. "Cancel it" marks the subscription cancelled with Undo and a shortcut to the provider's cancellation page.
- **Nothing slips when the window is closed** — reminders are computed by a SiYuan kernel plugin, and pushed to your phone through Bark, ntfy, Telegram, Server酱 (WeChat), WeCom, DingTalk, Feishu, Discord, Slack, Gotify or a webhook.
- **A dock that answers "what's next?"** — what's left to pay this month, decisions waiting for you, upcoming charges; the status bar shows the next one.
- **Manager** — monthly and yearly spend, savings, six-month forecast, calendar and category insights.
- **90+ services** with brand icons; search and add.
- **Multi-currency** totals combined with exchange rates.
- **Four themes** — Receipt (default), Calm, Wallet, Timeline — each in light and dark.
- **Made for SiYuan** — optional daily-note entries for charges and cancellations, a `/still` overview table, and a tool for SiYuan's AI agent.
- Data lives in `data/storage/petal/still/` and syncs with your workspace; JSON export/import.

## Demos

| Add a subscription | Still using it? |
|---|---|
| ![Add](https://raw.githubusercontent.com/suka233/still/main/docs/media/still-add-subscription.en-US.webp) | ![Decide](https://raw.githubusercontent.com/suka233/still/main/docs/media/still-decide.en-US.webp) |
| **Decide later** | **Themes** |
| ![Snooze](https://raw.githubusercontent.com/suka233/still/main/docs/media/still-snooze.en-US.webp) | ![Themes](https://raw.githubusercontent.com/suka233/still/main/docs/media/still-themes.en-US.webp) |
| **Calendar & insights** | **Overview in a note** |
| ![Calendar](https://raw.githubusercontent.com/suka233/still/main/docs/media/still-calendar.en-US.webp) | ![Slash](https://raw.githubusercontent.com/suka233/still/main/docs/media/still-slash.en-US.webp) |

Requires SiYuan 3.8.5 or later.

## Privacy

Apart from push channels you configure, Still only calls public exchange-rate APIs (open.er-api.com / Frankfurter; turn conversion off in Settings to stop). Your subscription data is never uploaded.

MIT · [github.com/suka233/still](https://github.com/suka233/still)
