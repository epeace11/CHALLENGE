import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every page is server-rendered on demand, so no incremental cache is needed.
export default defineCloudflareConfig({});
