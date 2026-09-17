import { createHash } from "node:crypto";
import { connect } from "node:tls";
import { test as base } from "@playwright/test";

async function currentLocalTestSpki(): Promise<string> {
  // Inspect only the disposable loopback server's public certificate. This does
  // not import a CA, read a private key, or alter the browser's global TLS policy.
  return new Promise((resolve, reject) => {
    let settled = false;
    const socket = connect({ host: "127.0.0.1", port: 3000, rejectUnauthorized: false });
    const finish = (pin?: string) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (pin) resolve(pin);
      else reject(new Error("pwa.local_test_certificate_unavailable"));
    };
    socket.setTimeout(5_000, () => finish());
    socket.once("error", () => finish());
    socket.once("secureConnect", () => {
      try {
        const certificate = socket.getPeerX509Certificate();
        if (certificate?.checkIP("127.0.0.1") !== "127.0.0.1") {
          finish();
          return;
        }
        const spki = certificate.publicKey.export({ type: "spki", format: "der" });
        finish(createHash("sha256").update(spki).digest("base64"));
      } catch {
        finish();
      }
    });
  });
}

export const test = base.extend({
  launchOptions: async ({ launchOptions, browserName }, use) => {
    if (browserName !== "chromium") throw new Error("pwa.expected_chromium_project");
    const args = launchOptions.args ?? [];
    if (args.some((arg) => arg.startsWith("--ignore-certificate-errors"))) {
      throw new Error("pwa.unreviewed_certificate_exception");
    }
    const pin = await currentLocalTestSpki();
    await use({
      ...launchOptions,
      args: [...args, `--ignore-certificate-errors-spki-list=${pin}`],
    });
  },
});
