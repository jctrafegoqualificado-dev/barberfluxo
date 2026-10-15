export interface KpiData {
  value: number;
  change: number | null;
  prevValue: number;
}

export interface NoshowRisk {
  label: "low" | "medium" | "high";
  score: number;
  noShowCount: number;
  totalCount: number;
}

export interface TodayAppointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  price: number;
  client: { name: string; phone: string | null };
  service: { name: string; price: number; duration: number } | null;
  barber: { id: string; user: { name: string } };
  subscription: { plan: { name: string } } | null;
  noshowRisk?: NoshowRisk | null;
}

export interface ForecastBucket {
  count: number;
  value: number;
}

export interface Forecast {
  done: ForecastBucket;
  confirmed: ForecastBucket;
  unconfirmed: ForecastBucket;
  noShow: ForecastBucket;
  best: number;
  realistic: number;
  dailyGoal: number | null;
  byHour: Array<{ hour: number; done: number; confirmed: number; unconfirmed: number }>;
  nowHour: number;
}

export interface SubscriptionDueItem {
  id: string;
  clientName: string;
  clientPhone: string | null;
  planName: string;
  amount: number;
  status: "PAID" | "WAITING" | "FAILED";
  method: string | null;
}

export interface SubscriptionsDueToday {
  total: number;
  paid: number;
  waiting: number;
  failed: number;
  items: SubscriptionDueItem[];
  overdue: { count: number; total: number };
}

export interface DashboardData {
  period: string;
  periodLabel: string;
  today: {
    appointments: TodayAppointment[];
    total: number;
    done: number;
    pending: number;
    noShow: number;
    revenue: number;
    expectedRevenue: number;
    nextAppointment: TodayAppointment | null;
  };
  forecast: Forecast;
  subscriptionsDueToday: SubscriptionsDueToday;
  newSubscriptions: { count: number; mrrAdded: number; prevCount: number; change: number | null };
  whatsapp: { status: string; lastConnectedAt: string | null };
  kpis: {
    revenue: KpiData;
    appointments: KpiData;
    ticketMedio: KpiData;
    clients: KpiData;
    newClients: number;
    returningClients: number;
    productSales: number;
  };
  mrr: number;
  activeSubscriptions: number;
  activeBarbers: number;
  projecaoMes: number;
  comissoes: { totalPago: number; totalVales: number; barbeirosPagos: number };
  topBarbers: Array<{ id: string; name: string; revenue: number; appointments: number }>;
  topClients: Array<{ id: string; name: string; totalSpent: number; visits: number }>;
  nps: {
    score: number | null;
    change: number | null;
    level: string;
    average: number;
    total: number;
    promoters: number;
    passives: number;
    detractors: number;
  };
  charts: {
    dailyRevenue: Array<{ date: string; revenue: number }>;
    appointmentStatus: { DONE: number; PENDING: number; CANCELLED: number; NO_SHOW: number };
  };
  birthdaysThisMonth: Array<{ id: string; name: string; phone: string | null; day: number }>;
  occupation: { pct: number; status: string; usedMinutes: number; availableMinutes: number };
}

/** Link de conversa no WhatsApp (número BR sem máscara). */
export function whatsappLink(phone: string | null | undefined, text: string) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const full = digits.startsWith("55") && digits.length > 11 ? digits : `55${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

export function firstName(name: string | null | undefined) {
  return (name || "").trim().split(" ")[0] || "cliente";
}
