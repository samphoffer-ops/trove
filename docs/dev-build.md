# iOS development build

Native tabs and Liquid Glass (design spec §3) don't run in Expo Go, so we test on a
development build installed on a physical iPhone. The `development` profile in
`mobile/eas.json` builds it: `developmentClient: true`, `distribution: internal`,
device build (not simulator).

## Before the first build

1. **Apple Developer Program membership is active** (#16). Internal distribution
   signs with an ad hoc provisioning profile, which a free Apple ID can't create.
2. **EAS CLI is installed and signed in** to the Expo account that owns project
   `410b58f4-7ec4-4eaa-b0a1-50ce023a1e0e`:

   ```bash
   npm install -g eas-cli
   eas login
   ```

3. **The iPhone is registered** with the Apple team. From `mobile/`, run this, pick
   "Website", and open the link or QR code on the iPhone to install the profile:

   ```bash
   npm run device:register
   ```

4. **Developer Mode is on** (iPhone: Settings → Privacy & Security → Developer Mode,
   then restart). iOS shows this toggle only after a development-signed app has been
   installed or the device has been connected to Xcode, so you may only see it after
   step 1 of the next section.

## Build and install

From `mobile/`:

```bash
npm run build:dev:ios
```

The first run asks you to sign in with your Apple ID and lets EAS create the
distribution certificate and ad hoc provisioning profile. Include the registered
iPhone when it asks which devices to provision. When the build finishes, open the
install link or QR code on the iPhone.

## Daily use

The build contains only native code. JavaScript comes from Metro on your Mac:

```bash
npm run start:dev
```

Open Trove on the iPhone (same Wi-Fi as the Mac) and choose the dev server, or scan
the QR code. Rebuild only when native code changes: new native modules, config
plugins, `app.json` changes, or an Expo SDK upgrade.

A newly registered iPhone isn't in an existing provisioning profile. After
`npm run device:register`, run `npm run build:dev:ios` again and accept the prompt
to add the new device.
