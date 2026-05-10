const INSTANCE_ID = process.env.ZAPI_INSTANCE_ID;
const TOKEN = process.env.ZAPI_TOKEN;
const CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

export async function sendWhatsApp(phone: string, message: string) {
  if (!INSTANCE_ID || !TOKEN || !CLIENT_TOKEN) return;

  const clean = phone.replace(/\D/g, "");
  const number = clean.startsWith("55") ? clean : `55${clean}`;

  try {
    await fetch(
      `https://api.z-api.io/instances/${INSTANCE_ID}/token/${TOKEN}/send-text`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": CLIENT_TOKEN,
        },
        body: JSON.stringify({ phone: number, message }),
      }
    );
  } catch (e) {
    console.error("[Z-API] Erro ao enviar mensagem:", e);
  }
}
