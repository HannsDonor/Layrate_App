const { withProjectBuildGradle } = require('@expo/config-plugins');
const path = require('path');

const withNotifeeMaven = (config) => {
  return withProjectBuildGradle(config, (config) => {
    const libsPath = path.join(
      config.modRequest.projectRoot,
      'node_modules',
      '@notifee',
      'react-native',
      'android',
      'libs'
    );
    const fileUrl = 'file:///' + libsPath.replace(/\\/g, '/');
    const mavenLine = `    maven { url '${fileUrl}' }`;

    if (!config.modResults.contents.includes(fileUrl)) {
      config.modResults.contents = config.modResults.contents.replace(
        /maven \{ url 'https:\/\/www\.jitpack\.io' \}/,
        `maven { url 'https://www.jitpack.io' }\n${mavenLine}`
      );
    }

    return config;
  });
};

module.exports = withNotifeeMaven;
