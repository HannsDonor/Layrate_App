const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const TEMPLATES_DIR = 'modules/android-widget';
const JAVA_SRC = path.join('app', 'src', 'main', 'java', 'com', 'anonymous', 'Layrate');
const RES_XML = path.join('app', 'src', 'main', 'res', 'xml');
const RES_LAYOUT = path.join('app', 'src', 'main', 'res', 'layout');
const RES_DRAWABLE = path.join('app', 'src', 'main', 'res', 'drawable');

const FILE_MAP = [
  { src: 'LayrateWidgetProvider.kt', dest: path.join(JAVA_SRC, 'LayrateWidgetProvider.kt') },
  { src: 'WidgetDataModule.kt', dest: path.join(JAVA_SRC, 'WidgetDataModule.kt') },
  { src: 'WidgetDataPackage.kt', dest: path.join(JAVA_SRC, 'WidgetDataPackage.kt') },
  { src: 'layrate_widget_info.xml', dest: path.join(RES_XML, 'layrate_widget_info.xml') },
  { src: 'layrate_widget_layout.xml', dest: path.join(RES_LAYOUT, 'layrate_widget_layout.xml') },
  { src: 'layrate_widget_logged_out_layout.xml', dest: path.join(RES_LAYOUT, 'layrate_widget_logged_out_layout.xml') },
  { src: 'widget_card_bg.xml', dest: path.join(RES_DRAWABLE, 'widget_card_bg.xml') },
  { src: 'widget_card_bg_solid.xml', dest: path.join(RES_DRAWABLE, 'widget_card_bg_solid.xml') },
  { src: 'widget_card_bg_transparent.xml', dest: path.join(RES_DRAWABLE, 'widget_card_bg_transparent.xml') },
  { src: 'widget_header_bg.xml', dest: path.join(RES_DRAWABLE, 'widget_header_bg.xml') },
  { src: 'widget_badge_bg.xml', dest: path.join(RES_DRAWABLE, 'widget_badge_bg.xml') },
  { src: 'widget_live_pill_bg.xml', dest: path.join(RES_DRAWABLE, 'widget_live_pill_bg.xml') },
  { src: 'widget_live_pill_white_bg.xml', dest: path.join(RES_DRAWABLE, 'widget_live_pill_white_bg.xml') },
  { src: 'widget_percent_chip_bg.xml', dest: path.join(RES_DRAWABLE, 'widget_percent_chip_bg.xml') },
  { src: 'ForegroundPollService.kt', dest: path.join(JAVA_SRC, 'ForegroundPollService.kt') },
  { src: 'PollServiceModule.kt', dest: path.join(JAVA_SRC, 'PollServiceModule.kt') },
  { src: 'PollServicePackage.kt', dest: path.join(JAVA_SRC, 'PollServicePackage.kt') },
  { src: 'background_widget.xml', dest: path.join(RES_DRAWABLE, 'background_widget.xml') },
  { src: 'widget_divider.xml', dest: path.join(RES_DRAWABLE, 'widget_divider.xml') },
  { src: 'widget_divider_vertical.xml', dest: path.join(RES_DRAWABLE, 'widget_divider_vertical.xml') },
  { src: 'widget_dot_green.xml', dest: path.join(RES_DRAWABLE, 'widget_dot_green.xml') },
  { src: 'widget_gauge_bg.xml', dest: path.join(RES_DRAWABLE, 'widget_gauge_bg.xml') },
  { src: 'widget_gauge_progress.xml', dest: path.join(RES_DRAWABLE, 'widget_gauge_progress.xml') },
  { src: 'widget_icon_bg.xml', dest: path.join(RES_DRAWABLE, 'widget_icon_bg.xml') },
  { src: 'widget_live_bg.xml', dest: path.join(RES_DRAWABLE, 'widget_live_bg.xml') },
];

// ── Direct manifest editing ─────────────────────────────────────────────

const REQUIRED_PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
  'android.permission.ACCESS_WIFI_STATE',
  'android.permission.CHANGE_WIFI_MULTICAST_STATE',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.VIBRATE',
];

const WIDGET_RECEIVER_BLOCK = `    <receiver android:name=".LayrateWidgetProvider" android:exported="true">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/layrate_widget_info"/>
    </receiver>`;

const SERVICE_BLOCK = `    <service android:name=".ForegroundPollService" android:foregroundServiceType="dataSync" android:exported="false"/>`;

function insertBeforeEndApp(tag, block, content) {
  if (content.includes(tag)) return content;
  const idx = content.lastIndexOf('</application>');
  if (idx !== -1) {
    return content.slice(0, idx) + block + '\n' + content.slice(idx);
  }
  return content;
}

function editManifest(manifestPath) {
  let content = fs.readFileSync(manifestPath, 'utf8');

  // Add required permissions
  for (const perm of REQUIRED_PERMISSIONS) {
    const marker = `name="${perm}`;
    const line = `<uses-permission android:name="${perm}"/>`;
    if (!content.includes(marker)) {
      // Insert before <application>
      const appIdx = content.indexOf('<application');
      if (appIdx !== -1) {
        content = content.slice(0, appIdx) + '  ' + line + '\n' + content.slice(appIdx);
      }
    }
  }

  // Add usesCleartextTraffic to <application> tag
  if (!content.includes('android:usesCleartextTraffic=')) {
    content = content.replace('<application', '<application android:usesCleartextTraffic="true"');
  }

  // Add widget receiver
  content = insertBeforeEndApp('.LayrateWidgetProvider', WIDGET_RECEIVER_BLOCK, content);

  // Add foreground service
  content = insertBeforeEndApp('.ForegroundPollService', SERVICE_BLOCK, content);

  fs.writeFileSync(manifestPath, content, 'utf8');
}

// ── Direct MainApplication editing ──────────────────────────────────────

function editMainApplication(appPath) {
  let content = fs.readFileSync(appPath, 'utf8');

  if (content.includes('WidgetDataPackage')) {
    fs.writeFileSync(appPath, content, 'utf8');
    return;
  }

  const ADD_LINE = '            add(WidgetDataPackage())\n            add(PollServicePackage())';

  // Try: find the comment template `// add(MyReactNativePackage())`
  let replaced = content.replace(
    /\/\/\s*add\(MyReactNativePackage\(\)\)[^\n]*/,
    ADD_LINE
  );

  if (replaced !== content) {
    // Also remove the preceding "Packages that cannot be..." comment line
    replaced = replaced.replace(
      /[^\n]*Packages that cannot be autolinked[^\n]*\n?/,
      ''
    );
    fs.writeFileSync(appPath, replaced, 'utf8');
    return;
  }

  // Fallback: find the getPackages() opening and insert before the closing brace
  replaced = content.replace(
    /(PackageList\(this\)\.packages\.apply\s*\{[^}]*)(\})/,
    (match, before, close) => {
      if (before.includes('add(WidgetDataPackage') || before.includes('add(PollServicePackage')) {
        return match;
      }
      return before + '\n' + ADD_LINE + '\n        ' + close;
    }
  );

  fs.writeFileSync(appPath, replaced, 'utf8');
}

// ── Dangerous mod action ────────────────────────────────────────────────

function dangerAction(config) {
  const androidRoot = config.modRequest.platformProjectRoot;
  const templatesRoot = path.join(config.modRequest.projectRoot, TEMPLATES_DIR);

  // 1. Create target dirs and copy widget files
  const targetDirs = [
    path.join(androidRoot, JAVA_SRC),
    path.join(androidRoot, RES_XML),
    path.join(androidRoot, RES_LAYOUT),
    path.join(androidRoot, RES_DRAWABLE),
  ];
  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  for (const file of FILE_MAP) {
    const srcPath = path.join(templatesRoot, file.src);
    const destPath = path.join(androidRoot, file.dest);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  // 2. Edit AndroidManifest.xml directly
  const manifestPath = path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml');
  if (fs.existsSync(manifestPath)) {
    editManifest(manifestPath);
  }

  // 3. Edit MainApplication.kt directly
  const appPath = path.join(androidRoot, JAVA_SRC, 'MainApplication.kt');
  if (fs.existsSync(appPath)) {
    editMainApplication(appPath);
  }

  return config;
}

const withAndroidWidget = (config) => {
  config = withDangerousMod(config, ['android', dangerAction]);
  return config;
};

module.exports = withAndroidWidget;
