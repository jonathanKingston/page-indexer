/**
 * Download Model Files
 * Downloads all-MiniLM-L6-v2 model files from HuggingFace to local models/ directory
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const MODEL_NAME = 'all-MiniLM-L6-v2';
const MODEL_BASE = `sentence-transformers/${MODEL_NAME}`;
const HUGGINGFACE_CDN = 'https://huggingface.co';

// Files to download
const FILES_TO_DOWNLOAD = [
  { name: 'model.onnx', path: `${MODEL_BASE}/resolve/main/onnx/model.onnx` },
  { name: 'tokenizer.json', path: `${MODEL_BASE}/resolve/main/tokenizer.json` },
  { name: 'config.json', path: `${MODEL_BASE}/resolve/main/config.json` },
  { name: 'tokenizer_config.json', path: `${MODEL_BASE}/resolve/main/tokenizer_config.json` },
  { name: 'vocab.txt', path: `${MODEL_BASE}/resolve/main/vocab.txt` },
];

const OUTPUT_DIR = path.join(__dirname, '..', 'generated', 'models', MODEL_NAME);

/**
 * Download a single file
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    https
      .get(url, response => {
        // Handle redirects (301, 302, 307, 308)
        if ([301, 302, 307, 308].includes(response.statusCode)) {
          file.close();
          fs.unlinkSync(destPath);

          // Resolve relative URLs
          let redirectUrl = response.headers.location;
          if (!redirectUrl.startsWith('http')) {
            const originalUrl = new URL(url);
            redirectUrl = new URL(redirectUrl, originalUrl.origin).href;
          }

          return downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(destPath);
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;

        response.on('data', chunk => {
          downloadedSize += chunk.length;
          const progress = totalSize ? ((downloadedSize / totalSize) * 100).toFixed(1) : 0;
          process.stdout.write(
            `\r  Progress: ${progress}% (${formatBytes(downloadedSize)}/${formatBytes(totalSize)})`
          );
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          process.stdout.write('\n');
          resolve(destPath);
        });

        response.on('error', err => {
          file.close();
          fs.unlinkSync(destPath);
          reject(err);
        });

        file.on('error', err => {
          file.close();
          if (fs.existsSync(destPath)) {
            fs.unlinkSync(destPath);
          }
          reject(err);
        });
      })
      .on('error', err => {
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
        reject(err);
      });
  });
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Main download function
 */
async function downloadModel() {
  console.log(`Downloading model files for ${MODEL_NAME}...`);
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created directory: ${OUTPUT_DIR}`);
  }

  let successCount = 0;
  let failCount = 0;

  for (const file of FILES_TO_DOWNLOAD) {
    const url = `${HUGGINGFACE_CDN}/${file.path}`;
    const destPath = path.join(OUTPUT_DIR, file.name);

    // Skip if file already exists
    if (fs.existsSync(destPath)) {
      console.log(`Skipping ${file.name} (already exists)`);
      continue;
    }

    console.log(`Downloading ${file.name}...`);
    try {
      await downloadFile(url, destPath);
      console.log(`✓ Successfully downloaded ${file.name}`);
      successCount++;
    } catch (error) {
      console.error(`✗ Failed to download ${file.name}: ${error.message}`);
      failCount++;
    }
  }

  console.log(`\nDownload complete: ${successCount} successful, ${failCount} failed`);

  if (failCount > 0) {
    process.exit(1);
  }
}

async function main() {
  await downloadModel();
  process.exit(0);
}

main();
