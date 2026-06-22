const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Start a new scan. Returns { scan_id, status }.
 * @param {string} repoUrl
 * @param {object} options - { branch, pr_number, scan_diff_only }
 */
export async function startScan(repoUrl, options = {}) {
  const body = { repo_url: repoUrl };
  if (options.branch) body.branch = options.branch;
  if (options.pr_number) body.pr_number = Number(options.pr_number);
  if (options.scan_diff_only) body.scan_diff_only = true;

  const res = await fetch(`${API_BASE}/api/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Scan failed (${res.status})`);
  }

  return res.json();
}

/**
 * Poll scan status. Returns full ScanStatus object.
 */
export async function getScanStatus(scanId) {
  const res = await fetch(`${API_BASE}/api/scan/${scanId}`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to get status (${res.status})`);
  }

  return res.json();
}

/**
 * Poll for scan completion.
 * @param {string} scanId
 * @param {function} onProgress - called with each status update
 * @param {AbortSignal} signal - for cancellation
 * @returns {Promise<object>} - the final scan result
 */
export async function pollScanResults(scanId, onProgress, signal) {
  const POLL_INTERVAL = 2000; // 2 seconds

  while (true) {
    if (signal?.aborted) {
      throw new Error("Scan cancelled");
    }

    const status = await getScanStatus(scanId);
    onProgress(status);

    if (status.status === "complete") {
      return status.result;
    }

    if (status.status === "failed") {
      throw new Error(status.error || "Scan failed");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}

/**
 * Retry AI explanation for a single finding.
 * @param {object} finding - the Finding object to re-explain
 * @returns {Promise<object>} - the updated Finding with explanation
 */
export async function retryExplanation(finding) {
  const res = await fetch(`${API_BASE}/api/findings/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(finding),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Retry failed (${res.status})`);
  }

  return res.json();
}
