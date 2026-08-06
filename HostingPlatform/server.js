import express from 'express';
import multer from 'multer';
import { Client as FtpClient } from 'basic-ftp';
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from local .env files or parent directory fallback
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Configure Multer memory storage for file uploads (max 15MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// Serve static frontend files from /public inside this folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Configuration Defaults
const MAIN_DOMAIN = process.env.MAIN_DOMAIN || 'novabyte-labs.com';
const FTP_HOST = process.env.FTP_HOST || 'ftp.novabyte-labs.com';
const FTP_USER = process.env.CPANEL_USER || 'novabyte';
const PROXY_URL = process.env.PROXY_URL || 'https://novabyte-labs.com/deploy-proxy.php';
const PROXY_SECRET = process.env.PROXY_SECRET || 'secret_nova_proxy_whitedev';
const FTP_PASSWORD = process.env.CPANEL_PASSWORD || 'black8devxKIdev';

const RESERVED_SUBDOMAINS = new Set([
  'www', 'mail', 'cpanel', 'webmail', 'ftp', 'api', 'admin',
  'root', 'static', 'hosts', 'novabyte', 'app', 'dashboard',
  'staging', 'dev', 'test', 'ssl', 'whm', 'autossl'
]);

/**
 * Sanitize and validate subdomain input.
 */
function validateSubdomain(rawSubdomain) {
  if (!rawSubdomain || typeof rawSubdomain !== 'string') {
    return { valid: false, error: 'Subdomain name is required.' };
  }

  const sanitized = rawSubdomain.toLowerCase().trim();

  if (sanitized.length < 3 || sanitized.length > 30) {
    return { valid: false, error: 'Subdomain must be between 3 and 30 characters.' };
  }

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(sanitized)) {
    return { valid: false, error: 'Subdomain can only contain lowercase letters, numbers, and single hyphens.' };
  }

  if (RESERVED_SUBDOMAINS.has(sanitized)) {
    return { valid: false, error: `Subdomain "${sanitized}" is reserved and cannot be used.` };
  }

  return { valid: true, sanitized };
}

/**
 * Detects if extracted ZIP contains a single root folder and shifts extract path.
 */
function resolveExtractPath(baseExtractDir) {
  try {
    function findIndexDir(dir) {
      if (!fs.existsSync(dir)) return null;
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const lower = entry.toLowerCase();
        if (lower === 'index.html' || lower === 'index.htm' || lower === 'index.php') {
          return dir;
        }
      }
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        if (fs.statSync(fullPath).isDirectory() && entry !== '__MACOSX' && entry !== '.DS_Store') {
          const found = findIndexDir(fullPath);
          if (found) return found;
        }
      }
      return null;
    }

    const indexDir = findIndexDir(baseExtractDir);
    if (indexDir) {
      console.log(`[Smart Index Location] Found root index file in: "${indexDir}". Setting upload root.`);
      return indexDir;
    }
  } catch (err) {
    console.warn('[Smart Index Location] Notice:', err.message);
  }

  return baseExtractDir;
}

// POST API Endpoint for website deployment
app.post('/api/deploy', (req, res, next) => {
  upload.single('zipFile')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ success: false, error: 'ZIP file size exceeds maximum limit of 15 MB.' });
        }
        return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ success: false, error: err.message || 'File upload failed.' });
    }
    next();
  });
}, async (req, res) => {
  const rawSubdomain = req.body?.subdomain;
  const zipFile = req.file;

  // 1. Validation & Input Sanitization
  const subValidation = validateSubdomain(rawSubdomain);
  if (!subValidation.valid) {
    return res.status(400).json({ success: false, error: subValidation.error });
  }
  const subdomain = subValidation.sanitized;

  if (!zipFile || !zipFile.size || zipFile.size === 0) {
    return res.status(400).json({ success: false, error: 'Please upload a valid non-empty .zip file.' });
  }

  const filename = zipFile.originalname || '';
  if (!filename.toLowerCase().endsWith('.zip')) {
    return res.status(400).json({ success: false, error: 'Only .zip files are allowed.' });
  }

  let tempDir = null;
  const ftpClient = new FtpClient();
  ftpClient.ftp.verbose = false;

  try {
    // Step A: PHP Proxy Call
    try {
      console.log(`Sending proxy request to ${PROXY_URL} for subdomain: ${subdomain}`);
      const proxyRes = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'NovaByte-Deploy-Runner/1.0',
        },
        body: JSON.stringify({
          secret: PROXY_SECRET,
          subdomain,
        }),
      });

      if (!proxyRes.ok) {
        const proxyErrText = await proxyRes.text().catch(() => '');
        console.warn(`Proxy warning (HTTP ${proxyRes.status}):`, proxyErrText);
      } else {
        const proxyData = await proxyRes.json().catch(() => ({}));
        console.log('Proxy Subdomain Creation Result:', proxyData);
      }
    } catch (proxyError) {
      console.warn('Proxy request exception (proceeding with FTP upload):', proxyError.message);
    }

    // Step B: Sandbox Extraction
    const osTemp = os.tmpdir();
    tempDir = fs.mkdtempSync(path.join(osTemp, 'novabyte-sandbox-'));

    const zipFilePath = path.join(tempDir, 'uploaded_site.zip');
    const extractOutputDir = path.join(tempDir, 'extract_output');
    fs.mkdirSync(extractOutputDir, { recursive: true });

    // Save ZIP buffer to disk
    fs.writeFileSync(zipFilePath, zipFile.buffer);

    // Extract using adm-zip
    try {
      const zip = new AdmZip(zipFilePath);
      zip.extractAllTo(extractOutputDir, true);
    } catch (extractErr) {
      return res.status(400).json({ success: false, error: `Invalid or corrupted .zip archive: ${extractErr.message}` });
    }

    // Step C: Double-Folder Fix
    const localExtractPath = resolveExtractPath(extractOutputDir);

    // Step D: FTP Sync
    let ftpConnected = false;

    try {
      await ftpClient.access({
        host: FTP_HOST,
        user: FTP_USER,
        password: FTP_PASSWORD,
        secure: false,
        timeout: 30000,
      });
      ftpConnected = true;
    } catch (ftpErr) {
      console.warn('FTP (secure: false) failed. Retrying with Explicit TLS:', ftpErr.message);
      try {
        await ftpClient.access({
          host: FTP_HOST,
          user: FTP_USER,
          password: FTP_PASSWORD,
          secure: true,
          secureOptions: { rejectUnauthorized: false },
          timeout: 30000,
        });
        ftpConnected = true;
      } catch (ftpErr2) {
        console.error('FTP Connection Failed:', ftpErr2.message);
        return res.status(500).json({
          success: false,
          error: `FTP Connection Error: Could not connect to ${FTP_HOST}. Please verify FTP credentials or server connection.`
        });
      }
    }

    const targetDir = `/public_html/hosts/${subdomain}`;

    // Ensure remote folder exists
    await ftpClient.ensureDir(targetDir);

    // Clear old files for a clean deployment
    try {
      await ftpClient.clearWorkingDir();
    } catch (clearErr) {
      console.warn('Notice: Working dir clear (already empty):', clearErr.message);
    }

    // Upload extracted files
    await ftpClient.uploadFromDir(localExtractPath);

    const liveUrl = `https://${subdomain}.${MAIN_DOMAIN}`;

    return res.json({
      success: true,
      message: 'Site deployed successfully!',
      subdomain,
      domain: MAIN_DOMAIN,
      liveUrl,
      deployedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Deployment Runner Error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'An unexpected error occurred during deployment.'
    });
  } finally {
    if (ftpClient && !ftpClient.closed) {
      ftpClient.close();
    }

    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`Sandbox temp directory cleaned up: ${tempDir}`);
      } catch (cleanupErr) {
        console.error('Error deleting sandbox temp dir:', cleanupErr);
      }
    }
  }
});

app.listen(PORT, () => {
  console.log(`🚀 NovaByte Host (HTML/CSS/JS version) running smoothly on http://localhost:${PORT}`);
});
