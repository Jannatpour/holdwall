export async function handler() {
  const baseUrl = (process.env.BASE_URL || "").replace(/\/+$/, "");
  const token = (process.env.OPS_BACKUP_TOKEN || "").trim();

  if (!baseUrl) throw new Error("BASE_URL not set");
  if (!token) throw new Error("OPS_BACKUP_TOKEN not set");

  const url = `${baseUrl}/api/backup/create`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ops-backup-token": token,
    },
    body: JSON.stringify({
      compression: true,
      encryption: true,
      storageProvider: "s3",
    }),
  });

  const text = await resp.text().catch(() => "");
  console.log(
    JSON.stringify(
      {
        ok: resp.ok,
        status: resp.status,
        url,
        body: text.slice(0, 2000),
      },
      null,
      2,
    ),
  );

  if (!resp.ok) {
    throw new Error(`Backup create failed (${resp.status})`);
  }

  return { ok: true };
}

