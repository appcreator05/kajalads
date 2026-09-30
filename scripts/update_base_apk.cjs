const fs = require('fs');
const JSZip = require('jszip');

async function updateBaseApk() {
  const apkPath = 'public/base-template.apk';
  if (!fs.existsSync(apkPath)) {
    console.error('base-template.apk not found!');
    return;
  }

  const apkData = fs.readFileSync(apkPath);
  const zip = await JSZip.loadAsync(apkData);

  const logoBuf = fs.readFileSync('public/logo.png');
  const splashBuf = fs.readFileSync('public/splash.png');

  // Inject into all mipmaps
  const mipmaps = [
    'res/mipmap-mdpi/ic_launcher.png',
    'res/mipmap-hdpi/ic_launcher.png',
    'res/mipmap-xhdpi/ic_launcher.png',
    'res/mipmap-xxhdpi/ic_launcher.png',
    'res/mipmap-xxxhdpi/ic_launcher.png',
    'res/mipmap-mdpi/ic_launcher_round.png',
    'res/mipmap-hdpi/ic_launcher_round.png',
    'res/mipmap-xhdpi/ic_launcher_round.png',
    'res/mipmap-xxhdpi/ic_launcher_round.png',
    'res/mipmap-xxxhdpi/ic_launcher_round.png',
    'res/mipmap-mdpi-v4/ic_launcher.png',
    'res/mipmap-hdpi-v4/ic_launcher.png',
    'res/mipmap-xhdpi-v4/ic_launcher.png',
    'res/mipmap-xxhdpi-v4/ic_launcher.png',
    'res/mipmap-xxxhdpi-v4/ic_launcher.png',
    'res/mipmap-mdpi-v4/ic_launcher_round.png',
    'res/mipmap-hdpi-v4/ic_launcher_round.png',
    'res/mipmap-xhdpi-v4/ic_launcher_round.png',
    'res/mipmap-xxhdpi-v4/ic_launcher_round.png',
    'res/mipmap-xxxhdpi-v4/ic_launcher_round.png',
  ];

  for (const m of mipmaps) {
    zip.file(m, logoBuf);
  }

  // Drawables
  zip.file('res/drawable/ic_launcher.png', logoBuf);
  zip.file('res/drawable/ic_launcher_round.png', logoBuf);
  zip.file('res/drawable/splash_bg.png', splashBuf);
  zip.file('res/drawable/splash_image.png', splashBuf);

  // Assets
  zip.file('assets/app_logo.png', logoBuf);
  zip.file('assets/web/app_logo.png', logoBuf);
  zip.file('assets/splash_image.png', splashBuf);

  // Patch resources.arsc if present so ic_launcher points away from vector XML to png
  const arscFile = zip.file('resources.arsc');
  if (arscFile) {
    const arscBuf = await arscFile.async('nodebuffer');
    let patched = Buffer.from(arscBuf);
    const target1 = Buffer.from('res/mipmap-anydpi-v26/ic_launcher.xml', 'latin1');
    const rep1 = Buffer.from('res/mipmap-xxxhdpi-v4/ic_launcher.png', 'latin1');
    const target2 = Buffer.from('res/mipmap-anydpi-v26/ic_launcher_round.xml', 'latin1');
    const rep2 = Buffer.from('res/mipmap-xxxhdpi-v4/ic_launcher_round.png', 'latin1');

    const idx1 = patched.indexOf(target1);
    if (idx1 !== -1) {
      rep1.copy(patched, idx1);
      console.log('Patched resources.arsc ic_launcher at', idx1);
    }
    const idx2 = patched.indexOf(target2);
    if (idx2 !== -1) {
      rep2.copy(patched, idx2);
      console.log('Patched resources.arsc ic_launcher_round at', idx2);
    }

    zip.file('resources.arsc', patched);
    zip.remove('res/mipmap-anydpi-v26/ic_launcher.xml');
    zip.remove('res/mipmap-anydpi-v26/ic_launcher_round.xml');
  }

  const newApk = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(apkPath, newApk);
  console.log('Successfully updated public/base-template.apk with new logo & splash!');
}

updateBaseApk().catch(console.error);
