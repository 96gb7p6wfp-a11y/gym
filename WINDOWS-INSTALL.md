# Private iPhone installation using Windows

This route uses a normal Apple ID, Windows and AltStore Classic. It does not need
your own Mac or paid Apple Developer membership. The app must be signed before
installation; an unsigned IPA cannot be opened directly on the phone.

## 1. Produce the iPhone app file in the cloud

The project includes an on-demand GitHub Actions workflow. It uses a hosted macOS
machine to compile the app without Apple certificates. You will need a GitHub
account/repository with Actions enabled and available macOS build minutes. Public
and private repositories have different quota/billing rules; check your account's
available quota before running.

1. Put this project's source in your GitHub repository, including `.github`,
   `scripts`, `assets`, `src`, `tests`, and the package lockfile. Do not upload
   `node_modules`, `.expo`, `dist`, or credentials. The generated `ios` folder is
   recreated by the workflow.
2. Open the repository's **Actions** tab and choose **Build iPhone app for personal
   signing**. Select **Run workflow**. Builds run only when you trigger them.
3. Wait for the build to complete. Download its **Setline-unsigned-iPhone**
   artifact, unzip it, and find `Setline-unsigned.ipa`.

The artifact is a Release app for physical iPhones with its JavaScript bundled,
so no dev server is required. The app targets iOS 16.4 or later. This macOS build
has not been run in the Linux workspace; a successful GitHub run is needed to
verify native compilation. The workflow uses no Apple ID or signing secrets.
It selects Xcode 26.3 on GitHub's macOS 15 image; if that image later retires the
version, update `DEVELOPER_DIR` to a supported current Xcode installation.

## 2. Sign and install it from Windows

Follow the current official [AltStore Classic Windows installation guide](https://faq.altstore.io/altstore-world/how-to-install-altstore-windows).
It covers the supported versions of iTunes/iCloud, AltServer, trusting the computer,
and installing AltStore Classic with your normal Apple ID. Enter your Apple ID only
in the signing tool's supported flow, never in this app's files or this chat.

Connect your iPhone, enable Developer Mode when requested, and install AltStore
Classic using AltServer. Transfer `Setline-unsigned.ipa` to the phone's Files app.
In AltStore Classic, open **My Apps**, tap **+**, and select the IPA. Let AltStore
sign and install Setline. The result is a separate Setline app/icon on your phone.

Free personal signatures expire after **seven days**. Keep AltServer available on
Windows and refresh the apps in AltStore before expiry. Apple normally limits free
accounts to three active sideloaded apps, including AltStore itself. Use the same
Apple ID when refreshing. These are Apple's personal-signing limits, not app fees.

## 3. Verify the installed app

Open Setline and test your main site features, navigation and saved data. The app
still loads the hosted website and needs an internet connection. Safari's stored
data/login sessions are separate from this app's storage. The site could not be
checked from this cloud because its proxy blocks the URL.

Official references:

- [Windows installation](https://faq.altstore.io/altstore-world/how-to-install-altstore-windows)
- [IPA distribution without a paid Developer account](https://faq.altstore.io/developers/distribute-with-altstore-classic)
- [Free account limits and refreshing](https://faq.altstore.io/altstore-world/your-altstore)

The reference content was checked in [AltStore's official FAQ repository](https://github.com/altstoreio/faq),
since the documentation website itself is blocked from this cloud.
