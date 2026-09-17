import { parseServerAddress } from "@libre-ai/web-platform";
import { createTemplateHandler } from "./handler";

const { hostname, port } = parseServerAddress(Bun.env);
const fetch = createTemplateHandler();

const server = Bun.serve({
  fetch,
  hostname,
  port,
});

console.log(`Libre AI reference listening on ${server.url.origin}`);
