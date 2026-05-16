"use client";

import { useState } from "react";
import {
  useWhatsAppInstance,
  type InstanceState,
} from "@/hooks/useWhatsAppInstance";

// ============================================================================
// Componente raiz
// ============================================================================

export default function WhatsAppManager() {
  const { state, action, provision, refreshQrCode, disconnect } =
    useWhatsAppInstance();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const isRunning = action.kind === "running";
  const showBadge =
    state.kind !== "loading" &&
    state.kind !== "no_instance" &&
    state.kind !== "error";

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <header className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <WhatsAppIcon className="h-7 w-7 text-emerald-600" />
          <h1 className="text-2xl font-semibold text-gray-900">WhatsApp</h1>
          {showBadge && <StatusBadge kind={state.kind} />}
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Conecte um número de WhatsApp para enviar e receber mensagens da barbearia.
        </p>
      </header>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {state.kind === "loading" && <LoadingView />}

        {state.kind === "no_instance" && (
          <NoInstanceView
            loading={isRunning && action.action === "provision"}
            onProvision={provision}
          />
        )}

        {state.kind === "pending" && (
          <PendingView
            instanceName={state.instanceName}
            qrcode={state.qrcode}
            refreshing={isRunning && action.action === "refreshQr"}
            onRefreshQr={refreshQrCode}
            onDisconnect={disconnect}
            disconnecting={isRunning && action.action === "disconnect"}
          />
        )}

        {state.kind === "connecting" && (
          <ConnectingView
            instanceName={state.instanceName}
            onDisconnect={disconnect}
            disconnecting={isRunning && action.action === "disconnect"}
          />
        )}

        {state.kind === "connected" && (
          <ConnectedView
            instanceName={state.instanceName}
            lastConnectedAt={state.lastConnectedAt}
            confirmOpen={confirmDisconnect}
            onAskDisconnect={() => setConfirmDisconnect(true)}
            onCancelDisconnect={() => setConfirmDisconnect(false)}
            onConfirmDisconnect={async () => {
              await disconnect();
              setConfirmDisconnect(false);
            }}
            loading={isRunning && action.action === "disconnect"}
          />
        )}

        {state.kind === "disconnected" && (
          <DisconnectedView
            instanceName={state.instanceName}
            lastConnectedAt={state.lastConnectedAt}
            loading={isRunning && action.action === "provision"}
            onReconnect={provision}
          />
        )}

        {state.kind === "error" && <ErrorView message={state.message} />}
      </section>

      {action.kind === "error" && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <strong className="font-medium">Erro:</strong> {action.message}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Subviews por estado
// ============================================================================

function LoadingView() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Spinner className="h-6 w-6 text-gray-400" />
      <p className="mt-3 text-sm text-gray-500">Carregando…</p>
    </div>
  );
}

function NoInstanceView({
  loading,
  onProvision,
}: {
  loading: boolean;
  onProvision: (manualData?: { instanceName: string; token: string }) => void;
}) {
  const [manualMode, setManualMode] = useState(false);
  const [name, setName] = useState("");
  const [token, setToken] = useState("");

  if (manualMode) {
    return (
      <div className="flex flex-col py-2">
        <h2 className="text-lg font-medium text-gray-900 mb-4 text-center">
          Conexão Manual
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome da Instância</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: barbearia-producao"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Token (API Key)</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Cole o token da Evolution aqui"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              disabled={loading || !name || !token}
              onClick={() => onProvision({ instanceName: name, token })}
              className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "Conectando..." : "Salvar e Conectar"}
            </button>
            <button
              type="button"
              onClick={() => setManualMode(false)}
              className="w-full text-sm text-gray-500 hover:text-gray-700 py-1"
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center py-6">
      <div className="rounded-full bg-emerald-50 p-3">
        <WhatsAppIcon className="h-8 w-8 text-emerald-600" />
      </div>
      <h2 className="mt-4 text-lg font-medium text-gray-900">
        Conectar WhatsApp
      </h2>
      <p className="mt-2 max-w-md text-sm text-gray-600">
        Clique em <strong>Provisionar</strong> para gerar um novo QR Code ou use a <strong>Conexão Manual</strong> se já tiver uma instância criada.
      </p>
      
      <div className="mt-6 flex flex-col gap-3 w-full max-w-xs">
        <button
          type="button"
          disabled={loading}
          onClick={() => onProvision()}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading && <Spinner className="h-4 w-4" />}
          Provisionar Novo QR Code
        </button>
        
        <button
          type="button"
          onClick={() => setManualMode(true)}
          className="text-sm text-emerald-600 font-medium hover:text-emerald-700"
        >
          Usar Conexão Manual (Avançado)
        </button>
      </div>
    </div>
  );
}

function PendingView({
  instanceName,
  qrcode,
  refreshing,
  onRefreshQr,
  onDisconnect,
  disconnecting,
}: {
  instanceName: string;
  qrcode: string | null;
  refreshing: boolean;
  onRefreshQr: () => void;
  onDisconnect: () => void;
  disconnecting: boolean;
}) {
  const src = qrcode
    ? qrcode.startsWith("data:")
      ? qrcode
      : `data:image/png;base64,${qrcode}`
    : null;

  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="text-lg font-medium text-gray-900">
        Escaneie o QR Code com o WhatsApp
      </h2>
      <ol className="mt-3 max-w-md text-left text-sm text-gray-600 space-y-1">
        <li>1. Abra o WhatsApp no celular</li>
        <li>
          2. Toque em <strong>Mais opções</strong> (Android) ou{" "}
          <strong>Configurações</strong> (iOS)
        </li>
        <li>
          3. Toque em <strong>Aparelhos conectados</strong>
        </li>
        <li>
          4. Toque em <strong>Conectar um aparelho</strong> e aponte o celular
          para o QR abaixo
        </li>
      </ol>

      <div className="mt-5 rounded-lg border border-gray-200 bg-white p-3">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt="QR Code para conectar WhatsApp"
            className="h-64 w-64 object-contain"
          />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center bg-gray-50">
            <Spinner className="h-6 w-6 text-gray-400" />
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={onRefreshQr}
          disabled={refreshing || disconnecting}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {refreshing ? (
            <Spinner className="h-3.5 w-3.5" />
          ) : (
            <RefreshIcon className="h-3.5 w-3.5" />
          )}
          Atualizar QR
        </button>

        <button
          type="button"
          onClick={onDisconnect}
          disabled={disconnecting}
          className="text-xs text-red-600 hover:text-red-700 hover:underline disabled:opacity-60"
        >
          {disconnecting ? "Cancelando..." : "Cancelar e Desconectar"}
        </button>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Atualizando automaticamente a cada 25s.
      </p>
      <p className="mt-1 text-xs text-gray-400">
        Instância: <code className="font-mono">{instanceName}</code>
      </p>
    </div>
  );
}

function ConnectingView({
  instanceName,
  onDisconnect,
  disconnecting,
}: {
  instanceName: string;
  onDisconnect: () => void;
  disconnecting: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center py-8">
      <Spinner className="h-8 w-8 text-blue-500" />
      <h2 className="mt-4 text-lg font-medium text-gray-900">Conectando…</h2>
      <p className="mt-1 max-w-md text-sm text-gray-600">
        O WhatsApp está sincronizando. Isso pode levar alguns segundos.
      </p>

      <button
        type="button"
        onClick={onDisconnect}
        disabled={disconnecting}
        className="mt-6 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
      >
        {disconnecting && <Spinner className="h-4 w-4 mr-2 inline" />}
        Desconectar e Resetar
      </button>

      <p className="mt-3 text-xs text-gray-500">
        Instância: <code className="font-mono">{instanceName}</code>
      </p>
    </div>
  );
}

function ConnectedView({
  instanceName,
  lastConnectedAt,
  confirmOpen,
  onAskDisconnect,
  onCancelDisconnect,
  onConfirmDisconnect,
  loading,
}: {
  instanceName: string;
  lastConnectedAt: string | null;
  confirmOpen: boolean;
  onAskDisconnect: () => void;
  onCancelDisconnect: () => void;
  onConfirmDisconnect: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center py-4">
      <div className="rounded-full bg-emerald-50 p-3">
        <CheckIcon className="h-8 w-8 text-emerald-600" />
      </div>
      <h2 className="mt-4 text-lg font-medium text-gray-900">
        WhatsApp conectado
      </h2>
      <p className="mt-2 max-w-md text-sm text-gray-600">
        Sua barbearia está pronta para enviar e receber mensagens.
      </p>

      <dl className="mt-5 w-full max-w-sm space-y-2 rounded-md bg-gray-50 p-3 text-left text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500">Instância</dt>
          <dd className="font-mono text-gray-900 truncate">{instanceName}</dd>
        </div>
        {lastConnectedAt && (
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Conectado em</dt>
            <dd className="text-gray-900">
              {new Date(lastConnectedAt).toLocaleString("pt-BR")}
            </dd>
          </div>
        )}
      </dl>

      {!confirmOpen ? (
        <button
          type="button"
          onClick={onAskDisconnect}
          className="mt-5 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Desconectar
        </button>
      ) : (
        <div
          role="alertdialog"
          aria-label="Confirmar desconexão"
          className="mt-5 w-full max-w-sm rounded-md border border-red-200 bg-red-50 p-3 text-left"
        >
          <p className="text-sm text-red-900">
            Tem certeza? A barbearia parará de enviar e receber mensagens até
            reconectar.
          </p>
          <div className="mt-3 flex gap-2 justify-end">
            <button
              type="button"
              onClick={onCancelDisconnect}
              disabled={loading}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirmDisconnect}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {loading && <Spinner className="h-3.5 w-3.5" />}
              Sim, desconectar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DisconnectedView({
  instanceName,
  lastConnectedAt,
  loading,
  onReconnect,
}: {
  instanceName: string;
  lastConnectedAt: string | null;
  loading: boolean;
  onReconnect: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center py-4">
      <div className="rounded-full bg-gray-100 p-3">
        <OfflineIcon className="h-8 w-8 text-gray-500" />
      </div>
      <h2 className="mt-4 text-lg font-medium text-gray-900">
        WhatsApp desconectado
      </h2>
      <p className="mt-2 max-w-md text-sm text-gray-600">
        A instância foi desconectada. Clique em <strong>Reconectar</strong>{" "}
        para gerar um novo QR Code.
      </p>

      {lastConnectedAt && (
        <p className="mt-3 text-xs text-gray-500">
          Última conexão: {new Date(lastConnectedAt).toLocaleString("pt-BR")}
        </p>
      )}

      <button
        type="button"
        disabled={loading}
        onClick={onReconnect}
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading && <Spinner className="h-4 w-4" />}
        Reconectar
      </button>

      <p className="mt-3 text-xs text-gray-400">
        Instância anterior: <code className="font-mono">{instanceName}</code>
      </p>
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center text-center py-6">
      <div className="rounded-full bg-red-50 p-3">
        <WarningIcon className="h-8 w-8 text-red-600" />
      </div>
      <h2 className="mt-4 text-lg font-medium text-gray-900">
        Não foi possível carregar o status
      </h2>
      <p className="mt-2 max-w-md text-sm text-gray-600">{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-5 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Tentar novamente
      </button>
    </div>
  );
}

// ============================================================================
// Badge de status
// ============================================================================

const STATUS_LABEL: Record<InstanceState["kind"], string> = {
  loading: "",
  no_instance: "",
  pending: "Aguardando QR",
  connecting: "Conectando",
  connected: "Conectado",
  disconnected: "Desconectado",
  error: "",
};

const STATUS_COLOR: Record<InstanceState["kind"], string> = {
  loading: "",
  no_instance: "",
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  connecting: "bg-blue-50 text-blue-800 border-blue-200",
  connected: "bg-emerald-50 text-emerald-800 border-emerald-200",
  disconnected: "bg-gray-100 text-gray-700 border-gray-200",
  error: "",
};

function StatusBadge({ kind }: { kind: InstanceState["kind"] }) {
  const label = STATUS_LABEL[kind];
  const color = STATUS_COLOR[kind];
  if (!label) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full bg-current ${
          kind === "pending" || kind === "connecting" ? "animate-pulse" : ""
        }`}
      />
      {label}
    </span>
  );
}

// ============================================================================
// Ícones (SVG inline para evitar dependências externas)
// ============================================================================

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeOpacity="0.25"
      />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function WhatsAppIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.891-11.893 11.891a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function OfflineIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      <line x1="23" y1="1" x2="1" y2="23" />
    </svg>
  );
}

function WarningIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function RefreshIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}
