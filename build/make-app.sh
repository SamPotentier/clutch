#!/bin/zsh
# Construit Clutch.app, l'installe dans /Applications et l'épingle au Dock (une seule fois).
set -e
cd "${0:A:h}/.."

# Icône .icns à partir de build/icon.png
ICONSET=build/icon.iconset
rm -rf $ICONSET && mkdir -p $ICONSET
for s in 16 32 128 256 512; do
  sips -z $s $s build/icon.png --out $ICONSET/icon_${s}x${s}.png >/dev/null
  sips -z $((s*2)) $((s*2)) build/icon.png --out $ICONSET/icon_${s}x${s}@2x.png >/dev/null
done
iconutil -c icns $ICONSET -o build/icon.icns
rm -rf $ICONSET

# Paquet sans asar : node-pty (natif) et les fichiers xterm sont chargés depuis le disque
npx --yes @electron/packager@20.3.0 . "Clutch" \
  --platform=darwin --arch=$(uname -m) --icon=build/icon.icns \
  --app-bundle-id=biz.cicd.clutch --no-asar --overwrite --out=dist \
  --ignore='^/dist' --ignore='^/build' --ignore='^/README.md'

APP="dist/Clutch-darwin-$(uname -m)/Clutch.app"
chmod +x "$APP"/Contents/Resources/app/node_modules/node-pty/prebuilds/darwin-*/spawn-helper
rm -rf "/Applications/Clutch.app" "/Applications/Terminal Hub.app" dist/Terminal\ Hub-darwin-*
cp -R "$APP" /Applications/
echo "Installé : /Applications/Clutch.app"

# Dock : remplace l'ancienne icône « Terminal Hub » par Clutch, ou ajoute Clutch s'il n'y est pas
python3 - <<'PY'
import plistlib, subprocess
raw = subprocess.run(['defaults', 'export', 'com.apple.dock', '-'], capture_output=True, check=True).stdout
dock = plistlib.loads(raw)
apps = dock.get('persistent-apps', [])
url = lambda a: a.get('tile-data', {}).get('file-data', {}).get('_CFURLString', '')
clutch = {'tile-data': {'file-data': {'_CFURLString': 'file:///Applications/Clutch.app/', '_CFURLStringType': 15}}}
changed = False
if not any('Clutch.app' in url(a) for a in apps):
    old = [i for i, a in enumerate(apps) if 'Terminal%20Hub.app' in url(a)]
    if old: apps[old[0]] = clutch
    else: apps.append(clutch)
    changed = True
kept = [a for a in apps if 'Terminal%20Hub.app' not in url(a)]
changed |= len(kept) != len(apps)
if changed:
    dock['persistent-apps'] = kept
    subprocess.run(['defaults', 'import', 'com.apple.dock', '-'], input=plistlib.dumps(dock), check=True)
    subprocess.run(['killall', 'Dock'])
    print('Dock mis à jour')
PY
