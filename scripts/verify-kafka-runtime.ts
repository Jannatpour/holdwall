/**
 * Kafka Runtime Verification
 *
 * Verifies Kafka broker connectivity, topic presence/metadata, consumer-group offsets/lag,
 * and (optionally) DLQ topic backlog.
 *
 * This script is safe to run in prod/staging when Kafka credentials are available.
 */

import { Kafka } from "kafkajs";

type Status = "pass" | "warning" | "fail" | "skipped";

function asList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toInt(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  const kafkaEnabled = process.env.KAFKA_ENABLED === "true";
  const brokers = asList(process.env.KAFKA_BROKERS);
  const eventsTopic = (process.env.KAFKA_EVENTS_TOPIC || "holdwall-events").trim();
  const groupId = (process.env.KAFKA_GROUP_ID || "holdwall-pipeline-worker").trim();
  const dlqTopic = (process.env.KAFKA_DLQ_TOPIC || "holdwall-dlq").trim();
  const dlqEnabled = process.env.KAFKA_DLQ_ENABLED !== "false";
  const tlsEnabled =
    process.env.KAFKA_SSL === "true" ||
    process.env.KAFKA_TLS === "true" ||
    brokers.some((b) => String(b).includes(":9094"));

  if (!kafkaEnabled || brokers.length === 0) {
    console.log(
      JSON.stringify(
        {
          status: "skipped" as Status,
          reason: "Kafka disabled or KAFKA_BROKERS not set",
          kafkaEnabled,
          brokers,
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || "holdwall-kafka-verify",
    brokers,
    ssl: tlsEnabled ? { rejectUnauthorized: true } : undefined,
  });

  const admin = kafka.admin();
  const report: any = {
    status: "pass" as Status,
    brokers,
    eventsTopic,
    groupId,
    checks: [] as Array<{ name: string; status: Status; details?: any }>,
  };

  const push = (name: string, status: Status, details?: any) => {
    report.checks.push({ name, status, details });
    if (status === "fail") report.status = "fail";
    if (status === "warning" && report.status === "pass") report.status = "warning";
  };

  try {
    await admin.connect();
  } catch (e: any) {
    push("admin.connect", "fail", { error: e?.message || String(e) });
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }

  try {
    const cluster = await admin.describeCluster();
    push("cluster.describe", "pass", cluster);

    const topics = await admin.listTopics();
    if (!topics.includes(eventsTopic)) {
      push("topic.events.exists", "fail", { missing: eventsTopic, topicsCount: topics.length });
    } else {
      push("topic.events.exists", "pass");
      const meta = await admin.fetchTopicMetadata({ topics: [eventsTopic] });
      const topicMeta = meta.topics?.[0];
      const partitions = topicMeta?.partitions?.length || 0;
      push("topic.events.metadata", "pass", { partitions });
    }

    // Group offsets + lag (best-effort)
    try {
      const topicOffsets = await admin.fetchTopicOffsets(eventsTopic);
      const groupOffsets = await admin.fetchOffsets({ groupId, topic: eventsTopic });

      const latestByPartition = new Map<number, number>();
      for (const p of topicOffsets) {
        latestByPartition.set(p.partition, toInt(p.offset));
      }

      let totalLag = 0;
      const partitions: any[] = [];
      for (const p of groupOffsets) {
        const committed = toInt(p.offset);
        const latest = latestByPartition.get(p.partition) ?? 0;
        const lag = committed >= 0 ? Math.max(0, latest - committed) : latest;
        totalLag += lag;
        partitions.push({ partition: p.partition, committed, latest, lag });
      }

      // Treat very large lag as warning (threshold configurable)
      const lagWarn = Number.parseInt(process.env.KAFKA_LAG_WARN_THRESHOLD || "1000", 10);
      push("group.lag", totalLag > lagWarn ? "warning" : "pass", { totalLag, lagWarn, partitions });
    } catch (e: any) {
      push("group.lag", "warning", { error: e?.message || String(e) });
    }

    // DLQ backlog (best-effort)
    if (dlqEnabled) {
      if (!topics.includes(dlqTopic)) {
        push("topic.dlq.exists", "warning", { missing: dlqTopic });
      } else {
        const dlqOffsets = await admin.fetchTopicOffsets(dlqTopic);
        const approxBacklog = dlqOffsets.reduce((acc, p) => acc + toInt(p.offset), 0);
        push("topic.dlq.backlog", approxBacklog > 0 ? "warning" : "pass", { approxBacklog });
      }
    } else {
      push("dlq.enabled", "skipped", { dlqEnabled: false });
    }
  } catch (e: any) {
    push("verify", "fail", { error: e?.message || String(e) });
  } finally {
    await admin.disconnect().catch(() => undefined);
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.status === "pass" ? 0 : report.status === "warning" ? 1 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

