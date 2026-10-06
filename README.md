# Setline gym — web app and PWA

This repository contains the complete available Setline project: a web/PWA app,
the optional React Native iPhone wrapper, assets, dependency lockfile, tests and
deployment configuration. The web version can be deployed on Vercel and added to
an iPhone's home screen without Apple signing or weekly renewals.

**The original gym website's source is not included:** it was not available in the
workspace. The current app opens `https://setline-eric.haoxuan2333.chatgpt.site`.
The web version embeds that hosted website; the native version uses WKWebView.
This repository does not recreate its workout features, backend or storage.

## Run locally

Use Node.js 24 LTS and run these commands from the repository root:

```sh
npm ci
npm run web
```

For a production build and local preview:

```sh
npm run build
npm run preview
```

`build` exports the Expo web app to `dist`, copies public assets, adds PWA metadata
and generates a service worker with a versioned cache. `dist` and `node_modules`
are generated outputs and are intentionally excluded from Git.

## Deploy on Vercel

1. Import `96gb7p6wfp-a11y/gym` into Vercel and choose branch `main`.
2. Use the repository root as the root directory and Node.js 24.
3. The included `vercel.json` sets framework **Other**, install command `npm ci`,
   build command `npm run build:web`, and output directory `dist`.
4. Deploy, open the HTTPS URL on your iPhone in Safari, tap **Share → Add to Home
   Screen → Add**.

No app secrets or Apple account are required by this wrapper. A Vercel deployment
has not been created from this workspace.

## PWA behavior and hosted-site dependency

The PWA includes a standalone manifest, regular/maskable icons, Apple touch icon,
installation guidance, sharing, reload controls, an offline state and a generated
service worker. It caches only this deployment's app shell and assets. The hosted
gym itself still needs an internet connection.

The original website could not be inspected because this cloud's network proxy
rejects its connection with HTTP 403. Its iframe policy, gym features and login
remain unverified. If it disallows embedding, the visible **Open website** link
opens the original site directly. Browser/Safari data and the iframe/app's storage
are separate and may be restricted by the browser's privacy policies. To deploy
the actual gym application independently, its original source and backend setup
are required.

## Checks

```sh
npm run typecheck
npm test
npm run build:web
npx playwright install chromium
npm run test:web
```

Browser tests exercise the app shell with a mocked gym page, including mobile
layout, installation instructions, reload, sharing, service-worker control and
offline reload. They do not verify the unavailable original site's behavior.

See `VALIDATION.md` for the current validation record.

## Optional native project

`App.tsx`, `app.json`, `eas.json` and `index.ts` preserve the native iPhone wrapper.
`npm start` opens the Expo development server; `npm run export:ios` validates its
iOS JavaScript bundle. `WINDOWS-INSTALL.md` and the manual unsigned-iOS workflow
describe personal signing if it is wanted later. These are optional and are not
required for Vercel or PWA installation.
