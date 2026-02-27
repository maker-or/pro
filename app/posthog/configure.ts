import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";

const key = process.env.POSTHOG_KEY;

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    "service.name": "my-node-service",
  }),

  logRecordProcessor: new BatchLogRecordProcessor(
    new OTLPLogExporter({
      url: "https://us.i.posthog.com/i/v1/logs",
      headers: {
        Authorization: `Bearer ${key}`,
      },
    }),
  ),
});

sdk.start();
