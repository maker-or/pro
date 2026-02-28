import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";

const token = process.env.AXIOM_TOKEN;
const dataset = process.env.AXIOM_DATASET;
const rawDomain = process.env.AXIOM_DOMAIN?.trim();
const normalizedDomain = rawDomain
  ? rawDomain.startsWith("http://") || rawDomain.startsWith("https://")
    ? rawDomain
    : `https://${rawDomain}`
  : undefined;
const domain = normalizedDomain?.replace(/\/$/, "");
const LOGS_URL = domain ? `${domain}/v1/logs` : undefined;
const TRACES_URL = domain ? `${domain}/v1/traces` : undefined;
const LOG_FLUSH_MS = Number(process.env.AXIOM_LOG_FLUSH_MS ?? "1000");

declare global {
  // eslint-disable-next-line no-var
  var __axiomSdkStarted: boolean | undefined;
}

export function startAxiomTelemetry(): void {
  if (globalThis.__axiomSdkStarted) return;
  if (!token || !dataset || !domain || !LOGS_URL || !TRACES_URL) {
    console.warn(
      "AXIOM_TOKEN, AXIOM_DATASET, or AXIOM_DOMAIN is not set; telemetry disabled.",
    );
    return;
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "X-Axiom-Dataset": dataset,
  };

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      "service.name": "machine-gateway",
      "service.version": process.env.npm_package_version ?? "unknown",
      "deployment.environment": process.env.NODE_ENV ?? "development",
    }),
    logRecordProcessor: new BatchLogRecordProcessor(
      new OTLPLogExporter({
        url: LOGS_URL,
        headers,
      }),
      {
        scheduledDelayMillis: Number.isFinite(LOG_FLUSH_MS)
          ? LOG_FLUSH_MS
          : 1000,
      },
    ),
    traceExporter: new OTLPTraceExporter({
      url: TRACES_URL,
      headers,
    }),
  });

  sdk.start();
  if (process.env.NODE_ENV !== "production") {
    console.info("Axiom OTLP telemetry initialized");
  }
  globalThis.__axiomSdkStarted = true;
}

startAxiomTelemetry();
