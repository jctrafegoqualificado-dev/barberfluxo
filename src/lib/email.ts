import { Resend } from "resend";

const FROM = process.env.RESEND_FROM_EMAIL ?? "IAdeBarbearia <onboarding@resend.dev>";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "");
}

export async function sendAppointmentConfirmation({
  to, clientName, shopName, serviceName, barberName, date, time, isSubscriber,
}: {
  to: string; clientName: string; shopName: string;
  serviceName: string; barberName: string; date: string; time: string; isSubscriber: boolean;
}) {
  if (!process.env.RESEND_API_KEY) return;

  const dateFormatted = new Date(date).toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `✂️ Agendamento confirmado — ${shopName}`,
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
        <!-- Header -->
        <tr><td style="background:#f59e0b;padding:32px;text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">✂️</div>
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">${shopName}</h1>
          <p style="margin:6px 0 0;color:#fffbeb;font-size:14px;">Seu agendamento foi confirmado!</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 24px;color:#3f3f46;font-size:16px;">Olá, <strong>${clientName}</strong>! 👋</p>
          <!-- Info card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;margin-bottom:24px;">
            <tr><td style="padding:16px 20px;border-bottom:1px solid #f4f4f5;">
              <span style="font-size:12px;color:#71717a;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Serviço</span>
              <p style="margin:4px 0 0;color:#09090b;font-size:15px;font-weight:600;">${serviceName}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid #f4f4f5;">
              <span style="font-size:12px;color:#71717a;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Barbeiro</span>
              <p style="margin:4px 0 0;color:#09090b;font-size:15px;font-weight:600;">${barberName}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid #f4f4f5;">
              <span style="font-size:12px;color:#71717a;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Data</span>
              <p style="margin:4px 0 0;color:#09090b;font-size:15px;font-weight:600;text-transform:capitalize;">${dateFormatted}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid #f4f4f5;">
              <span style="font-size:12px;color:#71717a;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Horário</span>
              <p style="margin:4px 0 0;color:#09090b;font-size:15px;font-weight:600;">${time}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;">
              <span style="font-size:12px;color:#71717a;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Pagamento</span>
              <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:${isSubscriber ? "#16a34a" : "#f59e0b"}">
                ${isSubscriber ? "✅ Coberto pela assinatura" : "💰 Pagar no local"}
              </p>
            </td></tr>
          </table>
          <p style="margin:0;color:#71717a;font-size:13px;text-align:center;">
            Qualquer dúvida, entre em contato com a barbearia.<br>Até lá! 💈
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#fafafa;border-top:1px solid #e4e4e7;padding:16px;text-align:center;">
          <p style="margin:0;color:#a1a1aa;font-size:12px;">BarberFluxo — Sistema de Gestão para Barbearias</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendSubscriptionConfirmation({
  to, clientName, shopName, planName, price, nextBilling,
}: {
  to: string; clientName: string; shopName: string;
  planName: string; price: number; nextBilling: Date;
}) {
  if (!process.env.RESEND_API_KEY) return;

  const nextDate = nextBilling.toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `💳 Assinatura ativada — ${shopName}`,
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr><td style="background:#18181b;padding:32px;text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">💳</div>
          <h1 style="margin:0;color:#f59e0b;font-size:22px;font-weight:800;">${shopName}</h1>
          <p style="margin:6px 0 0;color:#a1a1aa;font-size:14px;">Sua assinatura foi ativada!</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 24px;color:#3f3f46;font-size:16px;">Olá, <strong>${clientName}</strong>! 🎉</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;margin-bottom:24px;">
            <tr><td style="padding:16px 20px;border-bottom:1px solid #f4f4f5;">
              <span style="font-size:12px;color:#71717a;font-weight:600;text-transform:uppercase;">Plano</span>
              <p style="margin:4px 0 0;color:#09090b;font-size:15px;font-weight:700;">${planName}</p>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid #f4f4f5;">
              <span style="font-size:12px;color:#71717a;font-weight:600;text-transform:uppercase;">Valor</span>
              <p style="margin:4px 0 0;color:#09090b;font-size:15px;font-weight:700;">R$ ${price.toFixed(2).replace(".", ",")}/mês</p>
            </td></tr>
            <tr><td style="padding:16px 20px;">
              <span style="font-size:12px;color:#71717a;font-weight:600;text-transform:uppercase;">Próxima cobrança</span>
              <p style="margin:4px 0 0;color:#09090b;font-size:15px;font-weight:700;text-transform:capitalize;">${nextDate}</p>
            </td></tr>
          </table>
          <p style="margin:0;color:#71717a;font-size:13px;text-align:center;">
            Agora é só agendar e aproveitar os benefícios do plano. 💈
          </p>
        </td></tr>
        <tr><td style="background:#fafafa;border-top:1px solid #e4e4e7;padding:16px;text-align:center;">
          <p style="margin:0;color:#a1a1aa;font-size:12px;">BarberFluxo — Sistema de Gestão para Barbearias</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
