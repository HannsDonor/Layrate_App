const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const TEMPLATES_DIR = 'modules/android-widget';
const JAVA_SRC = path.join(
  'app', 'src', 'main', 'java', 'com', 'anonymous', 'Layrate'
);
const RES_XML = path.join('app', 'src', 'main', 'res', 'xml');
const RES_LAYOUT = path.join('app', 'src', 'main', 'res', 'layout');
const RES_DRAWABLE = path.join('app', 'src', 'main', 'res', 'drawable');
const MANIFEST_PATH = path.join(
  'app', 'src', 'main', 'AndroidManifest.xml'
);
const MAIN_APP_PATH = path.join(JAVA_SRC, 'MainApplication.kt');

const RECEIVER_BLOCK = `        <receiver android:name=".LayrateWidgetProvider" android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/layrate_widget_info" />
        </receiver>`;

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
];

const withAndroidWidget = (config) => {
  return withDangerousMod(config, ['android'], async (config) => {
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

    const manifestPath = path.join(androidRoot, MANIFEST_PATH);
    if (fs.existsSync(manifestPath)) {
      let manifestContent = fs.readFileSync(manifestPath, 'utf8');
      if (!manifestContent.includes('.LayrateWidgetProvider')) {
        manifestContent = manifestContent.replace(
          '</application>',
          `${RECEIVER_BLOCK}\n    </application>`
        );
        fs.writeFileSync(manifestPath, manifestContent, 'utf8');
      }
    }

    const mainAppPath = path.join(androidRoot, MAIN_APP_PATH);
    if (fs.existsSync(mainAppPath)) {
      let mainAppContent = fs.readFileSync(mainAppPath, 'utf8');
      if (!mainAppContent.includes('WidgetDataPackage()')) {
        mainAppContent = mainAppContent.replace(
          'add(PollServicePackage())',
          'add(PollServicePackage())\n              add(WidgetDataPackage())'
        );
        fs.writeFileSync(mainAppPath, mainAppContent, 'utf8');
      }
    }

    return config;
  });
};

module.exports = withAndroidWidget;
