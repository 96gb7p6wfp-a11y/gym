# Validation record

Prepared for a Vercel web/PWA deployment. The optional native iPhone project is
retained. No Vercel deployment, signed iOS binary or phone installation is claimed.

| Check | Result |
| --- | --- |
| Dependency installation | Passed; exact resolved versions recorded in `package-lock.json` |
| `npm run typecheck` | Passed |
| `npm test` | Passed: six test groups, zero failures, zero skips |
| `npm run build:web` | Passed; exports JavaScript, CSS, HTML, public assets, manifest and generated service worker into `dist` |
| `npm run test:web` | Passed: six Chromium browser scenarios, zero failures; mobile layout, install dialog, sharing, reload, manifest/icons and cached offline shell |
| `npm run export:ios` | Passed; Metro produced an iOS JavaScript/assets bundle |
| `npx expo prebuild --platform ios --no-install` | Passed; generated the native Setline Xcode project, app icon, Info.plist and Podfile |
| Website inspection | Blocked by this cloud's outbound proxy: CONNECT HTTP 403 |
| CocoaPods / Xcode compilation | Not run; Linux workspace has no Xcode toolchain |
| Signed physical-device build | Not run; Expo/Apple signing account setup required |
| iPhone functional checks | Not run; requires signed installation on an iPhone |
| Unsigned build helper syntax | Passed: `bash -n scripts/build-unsigned-ios.sh` |
| GitHub workflow structure | YAML parsed; verified manual-only trigger and read-only repository permission |
| Unsigned GitHub macOS build | Workflow added; native compilation not executed here |

The web/PWA provides home-screen installation, reload, sharing, an embedded gym
website, an always-visible original-site link and an offline app shell. The optional
native app provides safe areas, back/forward navigation, Reload, the iOS share sheet
and retry after network/process failure. Site features, iframe permission, login
and storage behavior remain unverified because the site could not be reached here.
These wrappers do not include the original gym website's source or backend.

Browser tests use a mocked gym response and the system Chromium executable.
Playwright's offline network emulation is preserved for cached reloads; a
documented navigator-status fixture handles Chromium resetting `navigator.onLine`
after a service-worker navigation. No real iPhone/Safari test is claimed.

Required site and GitHub API network destinations were saved in the cloud
environment draft. Draft saving does not apply runtime network access; activation
requires review/save in environment settings followed by environment publication.

The website connection remained TLS-verified; certificate checks were not bypassed.
No account credentials were requested in chat or saved into the app.

See `README.md` for Mac/Xcode personal signing, EAS internal distribution, or
`WINDOWS-INSTALL.md` for free Windows personal signing after a cloud unsigned build.
The cloud can retain dependencies and generated files. Vercel builds the web/PWA
from the committed source with `npm ci` and `npm run build:web`.
