"use client";
import { useEffect } from "react";
import Script from "next/script";

declare global {
  interface Window {
    SwaggerUIBundle?: (config: Record<string, unknown>) => unknown;
    SwaggerUIStandalonePreset?: unknown[];
    ui?: unknown;
  }
}

const SWAGGER_VERSION = "5.17.14";

export default function ApiDocsPage() {
  useEffect(() => {
    const linkId = "swagger-ui-css";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui.css`;
      document.head.appendChild(link);
    }
  }, []);

  function init() {
    if (!window.SwaggerUIBundle) return;
    window.ui = window.SwaggerUIBundle({
      url: "/api/v1/openapi",
      dom_id: "#swagger-ui",
      deepLinking: true,
      presets: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window.SwaggerUIBundle as any).presets?.apis,
        ...((window.SwaggerUIStandalonePreset as unknown[])?.slice(1) ?? []),
      ],
      layout: "StandaloneLayout",
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa" }}>
      <div id="swagger-ui" />
      <Script
        src={`https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui-bundle.js`}
        strategy="afterInteractive"
        onLoad={init}
      />
      <Script
        src={`https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui-standalone-preset.js`}
        strategy="afterInteractive"
        onLoad={init}
      />
    </div>
  );
}
