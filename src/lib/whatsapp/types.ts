export interface EvolutionWebhookBody {
  event: string;
  instance: string;
  data: {
    key: { remoteJid: string; fromMe: boolean; id: string };
    pushName?: string;
    message?: any;
    messageType: string;
    messageTimestamp: number;
    instanceId: string;
    source?: string;
  };
  date_time: string;
  sender: string;
  server_url: string;
  apikey: string;
}
