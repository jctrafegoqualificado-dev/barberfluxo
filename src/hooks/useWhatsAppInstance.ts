"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================================
// Tipos
// ============================================================================

export type InstanceStatus =
  | "PENDING"
  | "CONNECTING"
  | "CONNECTED"
  | "DISCONNECTED";

export type InstanceState =
  | { kind: "loading" }
  | { kind: "no_instance" }
  | {
      kind: "pending";
      instanceName: string;
      qrcode: string | null;
    }
  | { kind: "connecting"; instanceName: string }
  | {
      kind: "connected";
      instanceName: string;
      lastConnectedAt: string | null;
    }
  | {
      kind: "disconnected";
      instanceName: string;
      lastConnectedAt: string | null;
    }
  | { kind: "error"; message: string };

export type ActionKind = "provision" | "disconnect" | "refreshQr";

export type ActionState =
  | { kind: "idle" }
  | { kind: "running"; action: ActionKind }
  | { kind: "error"; message: string };

// ============================================================================
// Configuração
// ============================================================================

/** Intervalo de polling do status enquanto em PENDING/CONNECTING. */
const STATUS_POLL_MS = 3000;

/** Intervalo de auto-refresh do QR Code enquanto em PENDING (WhatsApp expira ~20s). */
const QR_REFRESH_MS = 25000;

// ============================================================================
// Tipos das respostas da API
// ============================================================================

interface StatusResponse {
  provisioned: boolean;
  status: InstanceStatus | null;
  evolutionInstanceName?: string;
  lastConnectedAt?: string | null;
  evolutionUnreachable?: boolean;
}

interface ProvisionResponse {
  instanceName: string;
  qrcode: string;
  status: "PENDING";
  message: string;
}

interface QrCodeResponse {
  qrcode: string;
  count: number;
}

// ============================================================================
// Helpers
// ============================================================================

function mapStatusResponse(r: StatusResponse): InstanceState {
  if (!r.provisioned) return { kind: "no_instance" };

  switch (r.status) {
    case "PENDING":
      // QR ainda não está em mãos — o efeito de refresh vai buscar via /qrcode
      return {
        kind: "pending",
        instanceName: r.evolutionInstanceName ?? "",
        qrcode: null,
      };
    case "CONNECTING":
      return {
        kind: "connecting",
        instanceName: r.evolutionInstanceName ?? "",
      };
    case "CONNECTED":
      return {
        kind: "connected",
        instanceName: r.evolutionInstanceName ?? "",
        lastConnectedAt: r.lastConnectedAt ?? null,
      };
    case "DISCONNECTED":
      return {
        kind: "disconnected",
        instanceName: r.evolutionInstanceName ?? "",
        lastConnectedAt: r.lastConnectedAt ?? null,
      };
    default:
      return {
        kind: "error",
        message: "Status desconhecido retornado pelo servidor",
      };
  }
}

async function asJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      /* corpo não é JSON, mantém null */
    }
  }
  if (!res.ok) {
    const msg =
      body && typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

// ============================================================================
// Hook
// ============================================================================

export function useWhatsAppInstance() {
  const [state, setState] = useState<InstanceState>({ kind: "loading" });
  const [action, setAction] = useState<ActionState>({ kind: "idle" });

  // Evita setState após unmount (StrictMode double-invoke + abort em navegação)
  const aliveRef = useRef(true);

  const safeSetState = useCallback((updater: InstanceState | ((p: InstanceState) => InstanceState)) => {
    if (!aliveRef.current) return;
    setState(updater as InstanceState);
  }, []);

  const safeSetAction = useCallback((s: ActionState) => {
    if (!aliveRef.current) return;
    setAction(s);
  }, []);

  // ------ Fetch / actions --------------------------------------------------

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/status", { cache: "no-store" });
      const data = await asJson<StatusResponse>(res);
      safeSetState(mapStatusResponse(data));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao buscar status";
      safeSetState({ kind: "error", message: msg });
    }
  }, [safeSetState]);

  const provision = useCallback(async () => {
    safeSetAction({ kind: "running", action: "provision" });
    try {
      const res = await fetch("/api/whatsapp/provision", { method: "POST" });
      const data = await asJson<ProvisionResponse>(res);
      safeSetState({
        kind: "pending",
        instanceName: data.instanceName,
        qrcode: data.qrcode,
      });
      safeSetAction({ kind: "idle" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao provisionar";
      safeSetAction({ kind: "error", message: msg });
    }
  }, [safeSetAction, safeSetState]);

  const refreshQrCode = useCallback(async () => {
    safeSetAction({ kind: "running", action: "refreshQr" });
    try {
      const res = await fetch("/api/whatsapp/qrcode", { cache: "no-store" });
      const data = await asJson<QrCodeResponse>(res);
      safeSetState((prev) =>
        prev.kind === "pending" ? { ...prev, qrcode: data.qrcode } : prev
      );
      safeSetAction({ kind: "idle" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao atualizar QR";
      safeSetAction({ kind: "error", message: msg });
    }
  }, [safeSetAction, safeSetState]);

  const disconnect = useCallback(async () => {
    safeSetAction({ kind: "running", action: "disconnect" });
    try {
      const res = await fetch("/api/whatsapp/disconnect", { method: "POST" });
      await asJson<{ disconnected: true }>(res);
      await fetchStatus();
      safeSetAction({ kind: "idle" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao desconectar";
      safeSetAction({ kind: "error", message: msg });
    }
  }, [fetchStatus, safeSetAction]);

  // ------ Effects ----------------------------------------------------------

  // Fetch inicial + cleanup do alive flag
  useEffect(() => {
    aliveRef.current = true;
    fetchStatus();
    return () => {
      aliveRef.current = false;
    };
  }, [fetchStatus]);

  // Polling do status enquanto PENDING/CONNECTING
  useEffect(() => {
    if (state.kind !== "pending" && state.kind !== "connecting") return;

    const id = window.setInterval(() => {
      if (!document.hidden) fetchStatus();
    }, STATUS_POLL_MS);
    return () => window.clearInterval(id);
  }, [state.kind, fetchStatus]);

  // Auto-refresh do QR enquanto PENDING
  useEffect(() => {
    if (state.kind !== "pending") return;

    // Se o QR está nulo (caso o status venha de polling sem QR), busca já
    if (state.qrcode === null) refreshQrCode();

    const id = window.setInterval(() => {
      if (!document.hidden) refreshQrCode();
    }, QR_REFRESH_MS);
    return () => window.clearInterval(id);
    // Importante: depende só do kind, não do qrcode, para não reiniciar o timer a cada refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind, refreshQrCode]);

  // Quando a aba volta a ficar visível, força um refetch
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) fetchStatus();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchStatus]);

  return {
    state,
    action,
    provision,
    refreshQrCode,
    disconnect,
    fetchStatus,
  };
}
