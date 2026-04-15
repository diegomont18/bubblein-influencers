import { Resend } from "resend";
import type { ApifyUsageState } from "./apify-usage";

const ADMIN_EMAIL = "diego@aihubstudio.com";

export function sendApifyUsageAlert(
  level: 70 | 85 | 95,
  state: ApifyUsageState
): void {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(`[apify-alerts] RESEND_API_KEY not set (would have sent ${level}% alert)`);
    return;
  }

  const pct = state.max_monthly_usage_usd > 0
    ? (state.monthly_usage_usd / state.max_monthly_usage_usd) * 100
    : 0;
  const usd = state.monthly_usage_usd.toFixed(2);
  const maxUsd = state.max_monthly_usage_usd.toFixed(2);
  const cycleEnd = state.billing_cycle_end
    ? new Date(state.billing_cycle_end).toLocaleDateString("pt-BR")
    : "—";

  const subjectBase = "[BubbleIn] Apify";
  let subject: string;
  let headline: string;

  if (level === 70) {
    subject = `${subjectBase} — 70% do limite mensal atingido (aviso)`;
    headline = "Apify atingiu 70% do limite mensal.";
  } else if (level === 85) {
    subject = `${subjectBase} — 85% do limite mensal (atenção)`;
    headline = "ATENÇÃO: Apify atingiu 85% do limite mensal. Reduza o consumo.";
  } else {
    subject = `${subjectBase} — 95% atingido, novas buscas BLOQUEADAS`;
    headline = "CRÍTICO: Apify atingiu 95% do limite. Novas buscas foram BLOQUEADAS pelo BubbleIn até o próximo ciclo ou aumento de limite.";
  }

  const body = `${headline}

Uso atual: $${usd} / $${maxUsd} (${pct.toFixed(1)}%)
Fim do ciclo: ${cycleEnd}

Gerencie o consumo no console: https://console.apify.com/account/current-billing

Este alerta só é enviado uma vez por ciclo de faturamento para cada nível.
---
BubbleIn — monitor Apify`;

  const resend = new Resend(apiKey);
  resend.emails.send({
    from: "BubbleIn Alerts <noreply@bubblein.com.br>",
    to: [ADMIN_EMAIL],
    subject,
    text: body,
  }).then(({ error }) => {
    if (error) console.error(`[apify-alerts] Send ${level}% failed:`, error.message);
    else console.log(`[apify-alerts] ${level}% alert sent to ${ADMIN_EMAIL}`);
  }).catch((err) => {
    console.error(`[apify-alerts] ${level}% exception:`, err);
  });
}
