/// <reference types="@cloudflare/workers-types" />

declare namespace Cloudflare {
  interface Env {
    ZLOZ_BACKEND: Fetcher;
  }
}
