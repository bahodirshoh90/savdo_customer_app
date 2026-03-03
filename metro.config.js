// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude .ico from assets (Jimp used by Expo does not support image/x-icon)
if (config.resolver && config.resolver.assetExts) {
  config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'ico');
}

// Block .ico files from resolution (avoid Jimp processing them)
if (!config.resolver.blockList) {
  config.resolver.blockList = [];
}
config.resolver.blockList.push(/\.ico$/);

// Custom transformer to skip .ico files (avoid Jimp image/x-icon error)
const originalTransform = config.transformer?.transform;
if (originalTransform) {
  config.transformer.transform = async (params) => {
    const path = params.filename || params.filePath || params.src || '';
    if (typeof path === 'string' && path.endsWith('.ico')) {
      return {
        output: [
          {
            type: 'js',
            data: {
              code: 'module.exports = null;',
              map: null,
            },
          },
        ],
      };
    }
    return originalTransform(params);
  };
}

// Custom resolver to skip .ico files
const originalResolveRequest = config.resolver?.resolveRequest;
if (originalResolveRequest) {
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    // Skip .ico files
    if (moduleName && moduleName.endsWith('.ico')) {
      return {
        type: 'empty',
      };
    }
    return originalResolveRequest(context, moduleName, platform);
  };
} else {
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    // Skip .ico files
    if (moduleName && moduleName.endsWith('.ico')) {
      return {
        type: 'empty',
      };
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
