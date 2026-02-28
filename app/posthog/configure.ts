import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";

const key = process.env.POSTHOG_KEY;

const LOGS_URL = "https://us.i.posthog.com/i/v1/logs";
const TRACES_URL = "https://us.i.posthog.com/i/v1/traces";

declare global {
  // eslint-disable-next-line no-var
  var __posthogSdkStarted: boolean | undefined;
}

export function startPostHogTelemetry(): void {
  if (globalThis.__posthogSdkStarted) return;
  if (!key) {
    console.warn("POSTHOG_KEY is not set; telemetry export is disabled.");
    return;
  }

  const headers = { Authorization: `Bearer ${key}` };

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
    ),
    traceExporter: new OTLPTraceExporter({
      url: TRACES_URL,
      headers,
    }),
  });

  sdk.start();
  globalThis.__posthogSdkStarted = true;
}

startPostHogTelemetry();
