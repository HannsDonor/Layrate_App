module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", {
        jsxImportSource: "react-native-css-interop",
        unstable_transformProfile: "hermes-v0",
      }],
    ],
    plugins: [
      "react-native-css-interop/dist/babel-plugin",
      "react-native-worklets/plugin",
    ],
  };
};
