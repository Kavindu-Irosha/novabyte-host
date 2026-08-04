<?php
/**
 * deploy-proxy.php
 * 
 * Secure cPanel Subdomain Provisioning Proxy
 * Place this file inside your server's public_html directory (e.g., https://novabyte-labs.com/deploy-proxy.php)
 * 
 * It receives a POST request from your Next.js backend, validates the secret key,
 * and calls the local cPanel UAPI internally (bypassing external firewall blocks).
 */

header('Content-Type: application/json');

// --- SERVER CONFIGURATION PLACEHOLDERS ---
$SECRET_KEY      = 'secret_nova_proxy_whitedev'; // Replace with a strong random key (matches PROXY_SECRET in .env.local)
$CPANEL_USER     = 'novabyte';                      // Your cPanel username
$CPANEL_PASSWORD = 'black8devxKIdev';     // Your cPanel password
$MAIN_DOMAIN     = 'novabyte-labs.com';             // Your root domain

// 1. Verify HTTP Request Method
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed. Only POST is accepted.']);
    exit;
}

// 2. Extract POST data (supports both JSON body and Form Data)
$rawInput = file_get_contents('php://input');
$jsonInput = json_decode($rawInput, true);

$providedSecret = $_POST['secret'] ?? $jsonInput['secret'] ?? '';
$subdomain      = $_POST['subdomain'] ?? $jsonInput['subdomain'] ?? '';

// 3. Verify Secret Key
if (empty($providedSecret) || !hash_equals($SECRET_KEY, $providedSecret)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized: Invalid secret key.']);
    exit;
}

// 4. Sanitize Subdomain
$subdomain = strtolower(trim($subdomain));
if (empty($subdomain) || !preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $subdomain)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid subdomain format.']);
    exit;
}

// 5. Construct Local cPanel UAPI URL (Internal loopback bypasses external 2083 firewall)
$uapiUrl = "https://127.0.0.1:2083/execute/SubDomain/addsubdomain?domain=" . urlencode($subdomain) . "&rootdomain=" . urlencode($MAIN_DOMAIN) . "&dir=" . urlencode("public_html/hosts/" . $subdomain);

// 6. Execute cPanel UAPI Call via cURL
$ch = curl_init();

curl_setopt_array($ch, [
    CURLOPT_URL            => $uapiUrl,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_SSL_VERIFYPEER => false, // cPanel self-signed internal cert bypass
    CURLOPT_SSL_VERIFYHOST => false,
    CURLOPT_USERPWD        => "$CPANEL_USER:$CPANEL_PASSWORD",
    CURLOPT_HTTPHEADER     => ['Accept: application/json'],
    CURLOPT_TIMEOUT        => 20,
]);

$responseBody = curl_exec($ch);
$httpCode     = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError    = curl_error($ch);
curl_close($ch);

if ($responseBody === false) {
    http_response_code(502);
    echo json_encode(['success' => false, 'error' => 'Internal cURL Error: ' . $curlError]);
    exit;
}

// 7. Parse and Return JSON Response
$uapiData = json_decode($responseBody, true);

if ($httpCode >= 200 && $httpCode < 300) {
    echo json_encode([
        'success'   => true,
        'subdomain' => $subdomain,
        'uapi'      => $uapiData
    ]);
} else {
    http_response_code($httpCode);
    echo json_encode([
        'success'   => false,
        'error'     => 'cPanel UAPI returned HTTP ' . $httpCode,
        'uapi'      => $uapiData
    ]);
}
