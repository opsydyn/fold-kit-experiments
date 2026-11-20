/// <reference types="@cloudflare/workers-types" />

declare namespace Cloudflare {
  interface Env {
    ZLOZ_BACKEND: Fetcher;
    QUESTMANCER?: Fetcher;
    QUESTMANCER_TEAM?: string;
    QUESTMANCER_PREVIEW_TEAM?: string;
  }
}
