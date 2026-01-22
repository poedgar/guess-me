const { withGradleProperties, withAppBuildGradle } = require('@expo/config-plugins');

function withAndroidCameraGradle(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.contents.includes('missingDimensionStrategy')) {
      return config;
    }

    const gradleContent = config.modResults.contents;
    
    // Find the defaultConfig block and add the missingDimensionStrategy
    const defaultConfigRegex = /(defaultConfig\s*\{[^}]*?)(\})/s;
    const match = gradleContent.match(defaultConfigRegex);
    
    if (match) {
      const beforeDefaultConfig = gradleContent.substring(0, match.index);
      const defaultConfigContent = match[1];
      const afterDefaultConfig = gradleContent.substring(match.index + match[0].length);
      
      // Add missingDimensionStrategy before the closing brace of defaultConfig
      const newDefaultConfigContent = defaultConfigContent + 
        '        missingDimensionStrategy \'react-native-camera\', \'general\'\n';
      
      config.modResults.contents = beforeDefaultConfig + newDefaultConfigContent + afterDefaultConfig;
    }

    return config;
  });
}

module.exports = withAndroidCameraGradle;
