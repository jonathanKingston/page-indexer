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

  // Configuration for running the extension in Chromium
  run: {
    // Start URL to open when the extension loads
    startUrl: ['chrome://extensions'],

    // Browser console settings
    browserConsole: false,

    // Automatically reload when files change
    reload: true,

    // Keep the browser profile between runs (useful for testing)
    keepProfileChanges: false,

    // Target browser (chromium includes Chrome, Edge, Brave, etc.)
    target: ['chromium'],
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
