import { NextResponse } from 'next/server';
import { Client as FtpClient } from 'basic-ftp';
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Configuration Defaults
const MAIN_DOMAIN = process.env.MAIN_DOMAIN || 'novabyte-labs.com';
const FTP_HOST = process.env.FTP_HOST || 'ftp.novabyte-labs.com';
const FTP_USER = process.env.CPANEL_USER || 'novabyte';
const PROXY_URL = process.env.PROXY_URL || 'https://novabyte-labs.com/deploy-proxy.php';
const PROXY_SECRET = process.env.PROXY_SECRET || 'secret_nova_proxy_whitedev';

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
 * Step C: Double-Folder Fix Helper.
 * Detects if extracted ZIP contains a single root folder (e.g. extracted_files/MySite/index.html),
 * and shifts localExtractPath directly to that inner folder.
 */
function resolveExtractPath(baseExtractDir) {
  try {
    const entries = fs.readdirSync(baseExtractDir);

    // Ignore macOS / Windows system junk entries
    const validEntries = entries.filter((entry) => {
      const lower = entry.toLowerCase();
      return lower !== '__macosx' && lower !== '.ds_store' && lower !== 'thumbs.db';
    });

    if (validEntries.length === 1) {
      const singlePath = path.join(baseExtractDir, validEntries[0]);
      if (fs.statSync(singlePath).isDirectory()) {
        console.log(`[Double-Folder Fix] Single master directory detected: "${validEntries[0]}". Shifting upload root.`);
        return singlePath;
      }
    }
  } catch (err) {
    console.warn('[Double-Folder Fix] Notice:', err.message);
  }

  return baseExtractDir;
}

export async function POST(request) {
  const ftpPassword = process.env.CPANEL_PASSWORD || 'black8devxKIdev';

  let formData;
  try {
    formData = await request.formData();
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Invalid request format. Expected multipart/form-data.' },
      { status: 400 }
    );
  }

  const rawSubdomain = formData.get('subdomain');
  const zipFile = formData.get('zipFile') || formData.get('file');

  // -------------------------------------------------------------
  // 1. Validation & Input Sanitization
  // -------------------------------------------------------------
  const subValidation = validateSubdomain(rawSubdomain);
  if (!subValidation.valid) {
    return NextResponse.json({ success: false, error: subValidation.error }, { status: 400 });
  }
  const subdomain = subValidation.sanitized;

  if (!zipFile || typeof zipFile.arrayBuffer !== 'function') {
    return NextResponse.json({ success: false, error: 'Please upload a valid .zip file.' }, { status: 400 });
  }

  const filename = zipFile.name || '';
  if (!filename.toLowerCase().endsWith('.zip')) {
    return NextResponse.json({ success: false, error: 'Only .zip files are allowed.' }, { status: 400 });
  }

  const maxSizeBytes = 50 * 1024 * 1024; // 50 MB
  if (zipFile.size > maxSizeBytes) {
    return NextResponse.json({ success: false, error: 'ZIP file size exceeds maximum limit of 50 MB.' }, { status: 400 });
  }

  let tempDir = null;
  const ftpClient = new FtpClient();
  ftpClient.ftp.verbose = false;

  try {
    // -------------------------------------------------------------
    // Step A: PHP Proxy Call (Create Subdomain Internally via cPanel UAPI)
    // -------------------------------------------------------------
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
        cache: 'no-store',
      });

      if (!proxyRes.ok) {
        const proxyErrText = await proxyRes.text().catch(() => '');
        console.warn(`Proxy warning (HTTP ${proxyRes.status}):`, proxyErrText);
        // Note: We continue execution in case subdomain already exists or proxy executed successfully
      } else {
        const proxyData = await proxyRes.json().catch(() => ({}));
        console.log('Proxy Subdomain Creation Result:', proxyData);
      }
    } catch (proxyError) {
      console.warn('Proxy request exception (proceeding with FTP upload):', proxyError.message);
    }

    // -------------------------------------------------------------
    // Step B: Local Sandbox Extraction (The Runner)
    // -------------------------------------------------------------
    const osTemp = os.tmpdir();
    tempDir = fs.mkdtempSync(path.join(osTemp, 'novabyte-sandbox-'));

    const zipFilePath = path.join(tempDir, 'uploaded_site.zip');
    const extractOutputDir = path.join(tempDir, 'extract_output');
    fs.mkdirSync(extractOutputDir, { recursive: true });

    // Save ZIP buffer to disk
    const zipBuffer = Buffer.from(await zipFile.arrayBuffer());
    fs.writeFileSync(zipFilePath, zipBuffer);

    // Extract using adm-zip
    const zip = new AdmZip(zipFilePath);
    zip.extractAllTo(extractOutputDir, true);

    // -------------------------------------------------------------
    // Step C: Double-Folder Fix
    // -------------------------------------------------------------
    const localExtractPath = resolveExtractPath(extractOutputDir);

    // -------------------------------------------------------------
    // Step D: FTP Sync (basic-ftp)
    // -------------------------------------------------------------
    let ftpConnected = false;

    // Connect to FTP (Try standard non-TLS first, fallback to explicit TLS)
    try {
      await ftpClient.access({
        host: FTP_HOST,
        user: FTP_USER,
        password: ftpPassword,
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
          password: ftpPassword,
          secure: true,
          secureOptions: { rejectUnauthorized: false },
          timeout: 30000,
        });
        ftpConnected = true;
      } catch (ftpErr2) {
        console.error('FTP Connection Failed:', ftpErr2.message);
        return NextResponse.json(
          {
            success: false,
            error: `FTP Connection Error: Could not connect to ${FTP_HOST}. Please verify FTP credentials or server connection.`
          },
          { status: 500 }
        );
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

    // Recursively sync extracted files
    await ftpClient.uploadFromDir(localExtractPath);

    const liveUrl = `https://${subdomain}.${MAIN_DOMAIN}`;

    // -------------------------------------------------------------
    // Step E: Return Success Response
    // -------------------------------------------------------------
    return NextResponse.json({
      success: true,
      message: 'Site deployed successfully!',
      subdomain,
      domain: MAIN_DOMAIN,
      liveUrl,
      deployedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Deployment Runner Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'An unexpected error occurred during deployment.' },
      { status: 500 }
    );
  } finally {
    // -------------------------------------------------------------
    // Step E: Cleanup FTP Socket & Local Temp Directory
    // -------------------------------------------------------------
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
}
