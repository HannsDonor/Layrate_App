const { withDangerousMod, withAndroidManifest, withMainApplication } = require('@expo/config-plugins');
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

function copyWidgetFiles(config) {
  const androidRoot = config.modRequest.platformProjectRoot;
  const templatesRoot = path.join(config.modRequest.projectRoot, TEMPLATES_DIR);

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

  return config;
}

function withAndroidManifestMod(config) {
  return withAndroidManifest(config, (manifestConfig) => {
    const manifest = manifestConfig.modResults.manifest;

    if (!manifest.application?.[0]?.['receiver']
        ?.some(r => r.$?.['android:name'] === '.LayrateWidgetProvider')) {
      const app = manifest.application[0];
      if (!app.receiver) app.receiver = [];
      app.receiver.push({
        $: { 'android:name': '.LayrateWidgetProvider', 'android:exported': 'true' },
        'intent-filter': [{ action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }] }],
        'meta-data': [{ $: { 'android:name': 'android.appwidget.provider', 'android:resource': '@xml/layrate_widget_info' } }],
      });
    }

    if (!manifest.application?.[0]?.['service']
        ?.some(s => s.$?.['android:name'] === '.ForegroundPollService')) {
      const app = manifest.application[0];
      if (!app.service) app.service = [];
      app.service.push({
        $: { 'android:name': '.ForegroundPollService', 'android:foregroundServiceType': 'dataSync', 'android:exported': 'false' },
      });
    }

    if (!manifest['uses-permission']?.some(p => p.$?.['android:name'] === 'android.permission.FOREGROUND_SERVICE')) {
      if (!manifest['uses-permission']) manifest['uses-permission'] = [];
      manifest['uses-permission'].push({ $: { 'android:name': 'android.permission.FOREGROUND_SERVICE' } });
    }
    if (!manifest['uses-permission']?.some(p => p.$?.['android:name'] === 'android.permission.FOREGROUND_SERVICE_DATA_SYNC')) {
      if (!manifest['uses-permission']) manifest['uses-permission'] = [];
      manifest['uses-permission'].push({ $: { 'android:name': 'android.permission.FOREGROUND_SERVICE_DATA_SYNC' } });
    }

    if (manifest.application?.[0]?.$?.['android:usesCleartextTraffic'] !== 'true') {
      if (!manifest.application[0].$) manifest.application[0].$ = {};
      manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
    }

    const mdnsp = ['android.permission.ACCESS_WIFI_STATE', 'android.permission.CHANGE_WIFI_MULTICAST_STATE'];
    for (const perm of mdnsp) {
      if (!manifest['uses-permission']?.some(p => p.$?.['android:name'] === perm)) {
        if (!manifest['uses-permission']) manifest['uses-permission'] = [];
        manifest['uses-permission'].push({ $: { 'android:name': perm } });
      }
    }

    return manifestConfig;
  });
}

function withMainApplicationMod(config) {
  return withMainApplication(config, (appConfig) => {
    let content = appConfig.modResults.contents;

    if (!content.includes('WidgetDataPackage')) {
      content = content.replace(
        '// Packages that cannot be autolinked yet can be added manually here, for example:',
        ''
      );
      content = content.replace(
        '// add(MyReactNativePackage())',
        'add(WidgetDataPackage())\n              add(PollServicePackage())'
      );
      appConfig.modResults.contents = content;
    }

    return appConfig;
  });
}

const withAndroidWidget = (config) => {
  const platform = 'android';
  const action = copyWidgetFiles;
  config = withDangerousMod(config, [platform, action]);
  config = withAndroidManifestMod(config);
  config = withMainApplicationMod(config);
  return config;
};

module.exports = withAndroidWidget;
