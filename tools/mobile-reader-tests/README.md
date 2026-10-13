# Mobile reader regression

Run from the repository root after building `UI/Web` in production mode.

```sh
node tools/mobile-reader-tests/preview.mjs
# In another terminal, with puppeteer-core available:
node tools/mobile-reader-tests/regression.mjs
```

The temporary preview serves the production build on localhost:1315 and proxies API/SignalR requests to the existing server on localhost:1314. Stop it with Ctrl+C after testing. It creates no container.

The regression uses Brave on macOS by default. Set `KAVITA_TEST_BROWSER` to another Chromium executable, and `PUPPETEER_MODULE` to an installed puppeteer-core module path if it is not resolvable locally. Optional overrides: `KAVITA_TEST_URL`, `KAVITA_TEST_DB`, `KAVITA_TEST_OUTPUT`.

This installation-specific integration test reads the local SQLite database in read-only mode to select the existing EPUB (致性別為蒙娜麗莎的你_ch001-004) and PDF (新世紀福音戰士_v01) fixtures and an existing admin API key. It keeps credentials in memory and redacts the key from failure output. It opens readers in incognito reading mode and intercepts progress writes, so test reading does not change saved progress. A fresh browser profile is used for every run.

Coverage includes 320/390/430px mobile layouts, EPUB paging, button accessible names, touch menu actions, Escape behavior, series return, PDF rendering/page input/next chapter, desktop toolbar visibility, and injected HTTP 500 errors with retry. Missing user cover images and the older server's absent optional Activity endpoint are recorded separately from intentionally injected failures. Screenshots and sanitized results are saved under `docs/2026-10-13-kavita-reader-improvements`.
