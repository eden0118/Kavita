# Media parser fixes for the local deployment

The source fix is in `Kavita.Services/Helpers/PdfMetadataExtractor.cs`: classic cross-reference tables are visited newest first, so `Dictionary.TryAdd` must retain the newest object offset when `/Prev` tables are visited. The existing cross-reference stream reader already uses this behavior.

`Kavita.Services.Tests/Helpers/PdfMetadataExtractorTests.cs` covers a PDF without incremental updates, one update reusing the catalog, and multiple updates reusing both catalog and metadata. It also verifies that an unchanged Info object remains available from an older section.

The EPUB fix in `Kavita.Services/BookService.cs` enables `IgnoreMissingNavManifestItemError` in both existing reader configurations. Fixed-layout EPUB 3 comics with a valid manifest and spine can be read even when their NAV item is absent. Other validation settings are retained. The patcher applies this same option to both compiled configurations. `BookServiceEpubOptionsTests.cs` checks both configurations against actual EPUBs with and without NAV, including their page content and reading order.

## Deployment

The running server is the official 0.9.1.4 binary, whereas this checkout contains additional changes. To deploy only these parser fixes, the Dockerfile derives from the exact existing official image digest and changes the corresponding compiled method using Mono.Cecil. It reuses the `Dictionary<long,long>.TryAdd` member reference already present in `ReadXRefStream` and discards its boolean return value. The patcher rejects any other input DLL hash or a signed assembly.

Build and run from the repository root:

```sh
docker compose build kavita
docker compose up -d kavita
```

The config, database, NAS mounts, frontend and port 1314 remain those of the current installation. The runtime image contains the patched DLL; Mono.Cecil and the SDK remain in the build stage.

This image is deliberately pinned to the current official release. To upgrade, either use an official release containing this source fix, or review and regenerate the patch for the new binary. The input hash guard prevents silently applying this patch to another release.

## Rollback

Change `compose.yaml` back to the original pinned image and remove the `build` entry, then run `docker compose up -d kavita`:

```yaml
image: jvmilazz0/kavita@sha256:31181a32f0dda73cae68721867028a7253d57881b58bea5754cd9e578e75421a
```

There is no database schema migration in this patch. A database and original compose backup were created in `data/config/backups/pdf-parser-fix-20261010-125743/` before deployment.

## Validation on 2026-10-10

- Before the source fix, the baseline PDF test passed and both incremental-update cases returned the original Series instead of the updated one. After the fix, all 3 cases passed. These tests were run in an isolated .NET 10 test project linking the actual parser and regression test source; the full repository suite was not run.
- The deployed DLL itself read Series `新世紀福音戰士` and Volume 1–13 from all 13 original NAS PDFs. These PDF files were not rewritten.
- Container startup and `/api/health` passed, and the running DLL hash matched the built patched DLL.
- The library scan completed at 14:54:07. Series 1189 contains 13 files, 13 volumes and 13 chapters. The scanner removed the 13 old per-volume Series.
- Volume 1's `book-info?includeWordCounts=true` returned HTTP 200 and 178 pages. SQLite `quick_check` returned `ok`.

## Whole Comics audit

The 2026-10-10 inventory covers 179 library folders, 1,162 EPUBs and 256 PDFs (1,418 files). All 1,162 library EPUBs opened successfully using the patched deployment DLL, including 285 previously rejected EPUBs without NAV. The raw runtime probe also checked 10 old EPUBs in NAS #recycle (1,172 checked overall); #recycle is excluded by Kavita and by the final library inventory. The EPUB reader regression cases passed in both configurations (4 cases); NAV-present baseline cases passed before the fix and NAV-missing cases failed before it. No EPUB archive rewrite is required. Four PDF folders had accidental same-format series splits: 網球王子 (42 files), 新網球王子 (30), 三眼神童 (16), and 堀與宮村 (16).

Before the full repair, an online SQLite backup and file/progress snapshot were saved to `data/config/backups/comics-full-repair-20261010-065917/`. The full Comics force scan completed at 15:35:35 with 1,418 files and 180 series. It removed 89 stale per-volume/per-chapter series. The final database comparison found exactly 1,418 unique indexed files, zero missing/extra files, and zero same-format split groups. Every indexed file has a positive page count, all 1,133 previously indexed comic paths are preserved, and other-library file paths match the pre-repair backup. SQLite `quick_check` returned `ok`. Runtime verification artifacts are in `/private/tmp/kavita-comics-audit/`; reading endpoint checks are performed separately.

The additional full PDF probe found 229 readable embedded metadata records with one consistent name per applicable folder, 23 PDFs that use the existing encrypted-metadata filename fallback, and 4 Citrus PDFs that use the existing invalid-Info filename fallback. All 27 fallback files have positive indexed page counts, and their folders have one series per format after the scan. Reading endpoints are also checked for these files. These existing fallbacks still produce media-issue warnings; the parser change does not decrypt or rewrite these PDFs.

Final reading checks passed: one `book-info` request for every one of the 180 groups, plus all 27 metadata-fallback PDFs (HTTP 200); representative PDF range reads (206); missing-NAV EPUB chapters/page (200), and an actual page JPEG resource (200). Evidence and the complete grouping table are saved beside the pre-repair backup in `data/config/backups/comics-full-repair-20261010-065917/report.md` and `verification/`. The deployed DLL SHA256 is `b22af185577f313b3def8d442f2b12df1f389f2f7bb5caa641ade4fef63d6547`.
