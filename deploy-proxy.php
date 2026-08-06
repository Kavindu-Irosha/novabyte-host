<?php
/**
 * deploy-proxy.php
 * 
 * Secure cPanel Subdomain Provisioning & Direct Site Deployer
 * Place this file inside your server's public_html directory (https://novabyte-labs.com/deploy-proxy.php)
 */

// Enable CORS for browser requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Configuration
$SECRET_KEY      = 'secret_nova_proxy_whitedev'; // Matches PROXY_SECRET in Next.js
$CPANEL_USER     = 'novabyte';
$CPANEL_PASSWORD = 'black8devxKIdev';
$MAIN_DOMAIN     = 'novabyte-labs.com';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed. Only POST is accepted.']);
    exit;
}

// 1. Extract POST parameters (supports Multipart FormData and JSON)
$providedSecret = $_POST['secret'] ?? '';
$subdomain      = $_POST['subdomain'] ?? '';

if (empty($providedSecret) || empty($subdomain)) {
    $rawInput = file_get_contents('php://input');
    if (!empty($rawInput)) {
        $jsonInput = json_decode($rawInput, true);
        if (is_array($jsonInput)) {
            $providedSecret = $providedSecret ?: ($jsonInput['secret'] ?? '');
            $subdomain      = $subdomain ?: ($jsonInput['subdomain'] ?? '');
        }
    }
}

// 2. Verify Secret Key
if (empty($providedSecret) || !hash_equals($SECRET_KEY, $providedSecret)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized: Invalid secret key.']);
    exit;
}

// 3. Sanitize Subdomain
$subdomain = strtolower(trim($subdomain));
if (empty($subdomain) || !preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $subdomain)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid subdomain format.']);
    exit;
}

$reserved = ['www', 'mail', 'cpanel', 'webmail', 'ftp', 'api', 'admin', 'root', 'static', 'hosts', 'novabyte', 'app', 'dashboard', 'staging', 'dev', 'test', 'ssl', 'whm', 'autossl'];
if (in_array($subdomain, $reserved)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Reserved subdomain name cannot be used.']);
    exit;
}

$targetRelPath = "public_html/hosts/" . $subdomain;
$targetAbsPath = $_SERVER['DOCUMENT_ROOT'] . "/hosts/" . $subdomain;

// 4. Create Subdomain via cPanel UAPI internally
$uapiUrl = "https://127.0.0.1:2083/execute/SubDomain/addsubdomain?domain=" . urlencode($subdomain) . "&rootdomain=" . urlencode($MAIN_DOMAIN) . "&dir=" . urlencode($targetRelPath);

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL            => $uapiUrl,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => false,
    CURLOPT_USERPWD        => "$CPANEL_USER:$CPANEL_PASSWORD",
    CURLOPT_HTTPHEADER     => ['Accept: application/json'],
    CURLOPT_TIMEOUT        => 25,
]);
$uapiRes = curl_exec($ch);
curl_close($ch);

// Ensure target directory exists
if (!is_dir($targetAbsPath)) {
    @mkdir($targetAbsPath, 0755, true);
}

// Helper to find index.html in nested folders
function findIndexFolder($dir) {
    if (!is_dir($dir)) return null;
    $items = array_diff(scandir($dir), array('.', '..'));
    foreach ($items as $item) {
        $lower = strtolower($item);
        if ($lower === 'index.html' || $lower === 'index.htm' || $lower === 'index.php') {
            return $dir;
        }
    }
    foreach ($items as $item) {
        $subPath = $dir . '/' . $item;
        if (is_dir($subPath) && $item !== '__MACOSX' && $item !== '.DS_Store') {
            $found = findIndexFolder($subPath);
            if ($found) return $found;
        }
    }
    return null;
}

// Helper to recursively copy/move contents
function moveFolderContents($srcDir, $destDir) {
    if ($srcDir === $destDir) return;
    $items = array_diff(scandir($srcDir), array('.', '..'));
    foreach ($items as $item) {
        $srcPath = $srcDir . '/' . $item;
        $destPath = $destDir . '/' . $item;
        @rename($srcPath, $destPath);
    }
}

// 5. Direct ZIP Extraction if file is uploaded
$fileUploaded = false;
$uploadedZip = $_FILES['zipFile'] ?? $_FILES['file'] ?? null;

if ($uploadedZip && isset($uploadedZip['tmp_name']) && is_uploaded_file($uploadedZip['tmp_name'])) {
    if ($uploadedZip['error'] === UPLOAD_ERR_OK) {
        $zip = new ZipArchive();
        if ($zip->open($uploadedZip['tmp_name']) === TRUE) {
            // Extract files directly to host folder
            $zip->extractTo($targetAbsPath);
            $zip->close();
            $fileUploaded = true;

            // Smart Index Location & Flattener
            $indexFolder = findIndexFolder($targetAbsPath);
            if ($indexFolder && $indexFolder !== $targetAbsPath) {
                moveFolderContents($indexFolder, $targetAbsPath);
            }
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Failed to extract uploaded ZIP file. Archive may be corrupted.']);
            exit;
        }
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'File upload failed with PHP upload error code: ' . $uploadedZip['error']]);
        exit;
    }
}

$liveUrl = "https://" . $subdomain . "." . $MAIN_DOMAIN;

echo json_encode([
    'success'      => true,
    'message'      => 'Subdomain provisioned and site deployed successfully!',
    'subdomain'    => $subdomain,
    'domain'       => $MAIN_DOMAIN,
    'liveUrl'      => $liveUrl,
    'fileUploaded' => $fileUploaded,
    'deployedAt'   => date('c'),
]);
