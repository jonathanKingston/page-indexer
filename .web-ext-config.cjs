module.exports = {
  // Source directory for the extension
  sourceDir: '.',

  // Files and directories to ignore when building/running
  ignoreFiles: [
    'node_modules/**',
    '.git/**',
    '.github/**',
    'scripts/**',
    'package.json',
    'package-lock.json',
    '.web-ext-config.cjs',
    '.gitignore',
    '.prettierrc',
    'README.md',
    'offscreen.js', // Unbundled version (we use the bundled one)
    '**/*.md',
    '**/.DS_Store',
  ],

  // Configuration for running the extension in Firefox
  run: {
    // Start URL to open when the extension loads
    startUrl: ['about:debugging#/runtime/this-firefox'],

    // Browser console settings
    browserConsole: false,

    // Automatically reload when files change
    reload: true,

    // Keep the browser profile between runs (useful for testing)
    keepProfileChanges: false,

    // Target browser (can be 'firefox-desktop', 'firefox-android', 'chromium')
    target: ['firefox-desktop'],
  },

  // Configuration for building the extension
  build: {
    overwriteDest: true,
  },

  // Lint configuration
  lint: {
    output: 'text',
    metadata: false,
  },
};
