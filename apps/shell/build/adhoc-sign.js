// electron-builder afterSign hook: ad-hoc sign the app bundle when no Apple
// Developer credentials are available.
//
// A completely unsigned .app bundle (Info.plist not bound, resources not
// sealed) makes macOS Gatekeeper report the app as "damaged and can't be
// opened". Ad-hoc signing (-s -) seals the bundle properly; Gatekeeper then
// treats it as a regular "unidentified developer" app, which can be opened via
// right-click → Open or by clearing the quarantine attribute.
const { execFileSync } = require('node:child_process')
const { readdirSync, existsSync } = require('node:fs')
const { join } = require('node:path')

exports.default = function (context) {
  if (process.platform !== 'darwin') return
  const { APPLE_KEYCHAIN_PROFILE, APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } =
    process.env
  // Real signing/notarization configured → the normal signing path already ran.
  if (APPLE_KEYCHAIN_PROFILE || (APPLE_ID && APPLE_APP_SPECIFIC_PASSWORD && APPLE_TEAM_ID)) return

  const appOutDir = context.appOutDir
  if (!appOutDir || !existsSync(appOutDir)) return
  const appName = readdirSync(appOutDir).find((name) => name.endsWith('.app'))
  if (!appName) return

  const appPath = join(appOutDir, appName)
  console.log(`[adhoc-sign] ad-hoc signing ${appPath}`)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
  execFileSync('codesign', ['--verify', '--verbose=2', appPath], { stdio: 'inherit' })
  console.log('[adhoc-sign] done')
}
