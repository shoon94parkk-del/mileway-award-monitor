export function formatEvents(events) {
  return events
    .filter((event) => event.type === "NEW")
    .map((event) => {
      const route = `${event.origin} → ${event.destination}`;
      const details = [event.cabin, event.fareClass, event.flight, event.seats == null ? null : `${event.seats}석`].filter(Boolean).join(" / ");
      return `🚨 NEW SEAT\n${event.date} ${route}\n${details}`;
    })
    .join("\n\n");
}

export async function notifyTelegram(config, events) {
  if (!config.notifications?.telegram_enabled) return { sent: false, reason: "disabled" };
  const text = formatEvents(events);
  if (!text) return { sent: false, reason: "no-new-events" };
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("Telegram 환경 변수 TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID가 없습니다.");

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!response.ok) throw new Error(`Telegram 알림 실패: HTTP ${response.status}`);
  return { sent: true };
}
