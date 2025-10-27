/**
 * Copy ONNX Runtime Files
 * Copies ONNX Runtime Web files from node_modules to generated/ort/
 */

const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, '..', 'node_modules', 'onnxruntime-web', 'dist');
const DEST_DIR = path.join(__dirname, '..', 'generated', 'ort');

// Files to copy from onnxruntime-web
const FILES_TO_COPY = [
  'ort.wasm.min.mjs',
  'ort.wasm.mjs',
  // WASM files
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
];

/**
 * Copy a file from source to destination
 */
function copyFile(src, dest) {
  return new Promise((resolve, reject) => {
    fs.copyFile(src, dest, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Main copy function
 */
async function copyORT() {
  console.log('Copying ONNX Runtime files...');
  console.log(`Source: ${SOURCE_DIR}`);
  console.log(`Destination: ${DEST_DIR}\n`);

  // Check if source directory exists
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Error: Source directory does not exist: ${SOURCE_DIR}`);
    console.error('Please run "npm install" first to install dependencies.');
    process.exit(1);
  }

  // Create destination directory
  if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
    console.log(`Created directory: ${DEST_DIR}`);
  }

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (const filename of FILES_TO_COPY) {
    const srcPath = path.join(SOURCE_DIR, filename);
    const destPath = path.join(DEST_DIR, filename);

    // Check if source file exists
    if (!fs.existsSync(srcPath)) {
      console.log(`Skipping ${filename} (not found in source)`);
      skippedCount++;
      continue;
    }

    // Skip if file already exists and has same size
    if (fs.existsSync(destPath)) {
      const srcStats = fs.statSync(srcPath);
      const destStats = fs.statSync(destPath);
      if (srcStats.size === destStats.size && srcStats.mtimeMs <= destStats.mtimeMs) {
        console.log(`Skipping ${filename} (already up to date)`);
        skippedCount++;
        continue;
      }
    }

    try {
      await copyFile(srcPath, destPath);
      const stats = fs.statSync(destPath);
      console.log(`✓ Copied ${filename} (${formatBytes(stats.size)})`);
      successCount++;
    } catch (error) {
      console.error(`✗ Failed to copy ${filename}: ${error.message}`);
      failCount++;
    }
  }

  console.log(
    `\nCopy complete: ${successCount} copied, ${skippedCount} skipped, ${failCount} failed`
  );

  if (failCount > 0) {
    process.exit(1);
  }
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Run the copy
copyORT().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
