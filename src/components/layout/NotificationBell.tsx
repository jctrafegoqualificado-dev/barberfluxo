"use client";
import { useEffect, useRef, useState } from "react";
import { Bell, AlertTriangle, Package, X, ChevronRight } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";

interface Notification {
  id: string; type: string; severity: string; title: string; message: string; link: string;
}

export default function NotificationBell() {
  const { token } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  async function load() {
    try {
      const r = await fetch("/api/barbershop/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const d = await r.json();
      setNotifications(d.notifications || []);
    } catch {}
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000); // atualiza a cada 1 min
    return () => clearInterval(interval);
  }, [token]);

  // Fecha ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const count = notifications.length;
  const hasHigh = notifications.some((n) => n.severity === "high");

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-zinc-800 transition-colors"
      >
        <Bell className="w-5 h-5 text-zinc-400" />
        {count > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${hasHigh ? "bg-red-500" : "bg-amber-500"}`}>
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-64 top-4 w-80 bg-white rounded-xl shadow-2xl border border-zinc-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <p className="font-semibold text-zinc-900 text-sm">Notificações</p>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-zinc-100 rounded-lg transition-colors">
              <X className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>

          {count === 0 ? (
            <div className="py-10 text-center text-zinc-400 text-sm">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Tudo em dia!
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-zinc-50">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { setOpen(false); router.push(n.link); }}
                  className={`w-full text-left px-4 py-3 flex gap-3 items-start hover:brightness-95 transition-all group ${n.severity === "high" ? "bg-red-50" : "bg-white hover:bg-zinc-50"}`}
                >
                  <div className={`mt-0.5 shrink-0 ${n.severity === "high" ? "text-red-500" : "text-amber-500"}`}>
                    {n.type === "LOW_STOCK" ? <Package className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${n.severity === "high" ? "text-red-700" : "text-zinc-800"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">{n.message}</p>
                    <p className={`text-xs font-medium mt-1 ${n.severity === "high" ? "text-red-500" : "text-amber-500"}`}>
                      Toque para resolver →
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0 mt-0.5 group-hover:text-zinc-500 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
