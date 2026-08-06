/**
 * NovaByte Host - Client-Side Interactive JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
  const MAIN_DOMAIN = 'novabyte-labs.com';

  // State
  let subdomain = '';
  let zipFile = null;
  let currentStep = 0;
  let stepTimer = null;
  let deployedResult = null;

  // DOM Elements
  const subdomainInput = document.getElementById('subdomain-input');
  const previewUrlEl = document.getElementById('preview-url');
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const dropzoneIdle = document.getElementById('dropzone-idle');
  const dropzoneSelected = document.getElementById('dropzone-selected');
  const fileNameEl = document.getElementById('file-name');
  const fileSizeEl = document.getElementById('file-size');
  const removeFileBtn = document.getElementById('remove-file-btn');
  const submitBtn = document.getElementById('submit-btn');

  const errorAlert = document.getElementById('error-alert');
  const errorMessageEl = document.getElementById('error-message');

  const deployForm = document.getElementById('deploy-form');
  const deployProgress = document.getElementById('deploy-progress');
  const targetSubdomainText = document.getElementById('target-subdomain-text');
  const stepperList = document.getElementById('stepper-list');
  const progressBarFill = document.getElementById('progress-bar-fill');

  const deploySuccess = document.getElementById('deploy-success');
  const liveUrlLink = document.getElementById('live-url-link');
  const openSiteBtn = document.getElementById('open-site-btn');
  const copyLinkBtn = document.getElementById('copy-link-btn');
  const copyText = document.getElementById('copy-text');
  const copyIcon = document.getElementById('copy-icon');
  const checkIcon = document.getElementById('check-icon');
  const deployAnotherBtn = document.getElementById('deploy-another-btn');

  const steps = [
    { title: "Connecting to Whitedev's Server...", desc: 'Checking cPanel domain rules...' },
    { title: 'Creating cPanel Subdomain', desc: 'Provisioning DNS & SSL path...' },
    { title: 'FTP Asset Upload', desc: 'Transferring site.zip package to Server...' },
    { title: 'Server File Extraction', desc: 'Extracting static assets natively...' },
    { title: 'Deployment Live', desc: 'Verifying HTTPS & live endpoints...' },
  ];

  // Utility: Format File Size
  function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Update Submit Button State
  function updateSubmitState() {
    const sanitized = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const isValidSubdomain = sanitized.length >= 3;
    submitBtn.disabled = !(isValidSubdomain && zipFile);
  }

  // Subdomain Sanitization & Preview
  function handleSubdomainInput() {
    const rawVal = subdomainInput.value;
    const cleaned = rawVal.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    subdomain = cleaned;
    subdomainInput.value = cleaned;

    hideError();

    if (cleaned) {
      previewUrlEl.textContent = `https://${cleaned}.${MAIN_DOMAIN}`;
    } else {
      previewUrlEl.textContent = `https://your-site.${MAIN_DOMAIN}`;
    }

    updateSubmitState();
  }

  subdomainInput.addEventListener('input', handleSubdomainInput);

  // File Dropzone Handling
  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('#remove-file-btn')) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-active');
  });

  dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-active');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-active');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });

  function handleFileSelect(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      showError('Please select a valid .zip archive containing your static website.');
      return;
    }

    const MAX_LIMIT_MB = 15;
    const MAX_LIMIT_BYTES = MAX_LIMIT_MB * 1024 * 1024;
    if (file.size > MAX_LIMIT_BYTES) {
      showError(`Selected file is too large (${formatFileSize(file.size)}). Maximum upload limit is ${MAX_LIMIT_MB}MB. Please compress high-res images or remove large video files before uploading.`);
      return;
    }

    zipFile = file;
    hideError();

    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = formatFileSize(file.size);

    dropzoneIdle.classList.add('hidden');
    dropzoneSelected.classList.remove('hidden');
    dropzone.classList.add('has-file');

    updateSubmitState();
  }

  removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    zipFile = null;
    fileInput.value = '';

    dropzoneIdle.classList.remove('hidden');
    dropzoneSelected.classList.add('hidden');
    dropzone.classList.remove('has-file');

    updateSubmitState();
  });

  // Error Banner Controls
  function showError(msg) {
    errorMessageEl.textContent = msg;
    errorAlert.classList.remove('hidden');
  }

  function hideError() {
    errorAlert.classList.add('hidden');
  }

  // Stepper UI Renderer
  function renderStepper() {
    stepperList.innerHTML = '';
    steps.forEach((step, idx) => {
      const isDone = idx < currentStep;
      const isCurrent = idx === currentStep;

      const item = document.createElement('div');
      item.className = `step-item ${isDone ? 'is-done' : isCurrent ? 'is-current' : 'is-pending'}`;

      let iconHtml = '';
      if (isDone) {
        iconHtml = `<svg class="icon text-emerald flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
      } else if (isCurrent) {
        iconHtml = `<svg class="icon text-cyan flex-shrink-0 spin-ring" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
      } else {
        iconHtml = `<div class="step-number-circle font-mono">${idx + 1}</div>`;
      }

      item.innerHTML = `
        ${iconHtml}
        <div class="step-info">
          <p class="step-title-text">${step.title}</p>
          <p class="step-desc-text">${step.desc}</p>
        </div>
      `;

      stepperList.appendChild(item);
    });

    const percent = Math.min(100, Math.round(((currentStep + 1) / steps.length) * 100));
    progressBarFill.style.width = `${percent}%`;
  }

  // Form Submission
  deployForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const sanitized = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');

    if (!sanitized || sanitized.length < 3) {
      showError('Please enter a subdomain name of at least 3 characters.');
      return;
    }

    if (!zipFile) {
      showError('Please upload a .zip file containing your static website.');
      return;
    }

    hideError();

    // Switch to Progress View
    deployForm.classList.add('hidden');
    deployProgress.classList.remove('hidden');
    targetSubdomainText.textContent = sanitized;

    currentStep = 0;
    renderStepper();

    // Simulate progress animation steps
    stepTimer = setInterval(() => {
      if (currentStep < steps.length - 2) {
        currentStep++;
        renderStepper();
      }
    }, 1800);

    const formData = new FormData();
    formData.append('subdomain', sanitized);
    formData.append('zipFile', zipFile);

    try {
      let response;
      let data;

      try {
        response = await fetch('/api/deploy', {
          method: 'POST',
          body: formData,
        });
        const responseText = await response.text();
        try {
          data = responseText ? JSON.parse(responseText) : {};
        } catch (parseErr) {
          data = {};
        }
      } catch (fetchErr) {
        response = { ok: false, status: 0 };
        data = {};
      }

      // Fallback: If cloud serverless platform rejects payload (HTTP 413) or times out, upload directly via PHP proxy
      if (!response.ok && (response.status === 413 || response.status === 504 || response.status === 502 || response.status === 0 || !data.success)) {
        try {
          const proxyUrl = 'https://novabyte-labs.com/deploy-proxy.php';
          const proxyFormData = new FormData();
          proxyFormData.append('subdomain', sanitized);
          proxyFormData.append('zipFile', zipFile);
          proxyFormData.append('secret', 'secret_nova_proxy_whitedev');

          const proxyRes = await fetch(proxyUrl, {
            method: 'POST',
            body: proxyFormData,
          });

          const proxyText = await proxyRes.text();
          let proxyData;
          try {
            proxyData = proxyText ? JSON.parse(proxyText) : {};
          } catch (pe) {
            proxyData = {};
          }

          if (proxyRes.ok && proxyData.success) {
            data = proxyData;
            response = { ok: true, status: 200 };
          } else if (response.status === 413 && (!proxyRes.ok || !proxyData.success)) {
            const sizeFormatted = formatFileSize(zipFile?.size);
            throw new Error(`File upload failed (${sizeFormatted}). Server payload limit exceeded (HTTP 413). Please compress your ZIP file.`);
          }
        } catch (fallbackErr) {
          if (data && data.error) {
            throw new Error(data.error);
          }
          throw fallbackErr;
        }
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Deployment failed (HTTP ${response.status}). Please verify your site files and try again.`);
      }

      currentStep = steps.length - 1;
      renderStepper();

      // Short delay for smooth transition to success view
      setTimeout(() => {
        deployedResult = data;
        showSuccessView(data);
      }, 600);

    } catch (err) {
      clearInterval(stepTimer);
      deployProgress.classList.add('hidden');
      deployForm.classList.remove('hidden');
      showError(err.message || 'An unexpected error occurred while deploying your site.');
    }
  });

  // Render Success View
  function showSuccessView(data) {
    deployProgress.classList.add('hidden');
    deploySuccess.classList.remove('hidden');

    liveUrlLink.textContent = data.liveUrl;
    liveUrlLink.href = data.liveUrl;
    openSiteBtn.href = data.liveUrl;
  }

  // Copy Link functionality
  copyLinkBtn.addEventListener('click', () => {
    if (!deployedResult?.liveUrl) return;

    navigator.clipboard.writeText(deployedResult.liveUrl);

    copyIcon.classList.add('hidden');
    checkIcon.classList.remove('hidden');
    copyText.textContent = 'Copied!';
    copyText.classList.add('text-emerald');

    setTimeout(() => {
      copyIcon.classList.remove('hidden');
      checkIcon.classList.add('hidden');
      copyText.textContent = 'Copy Link';
      copyText.classList.remove('text-emerald');
    }, 2500);
  });

  // Deploy Another button handler
  deployAnotherBtn.addEventListener('click', () => {
    subdomainInput.value = '';
    subdomain = '';
    zipFile = null;
    fileInput.value = '';
    deployedResult = null;

    dropzoneIdle.classList.remove('hidden');
    dropzoneSelected.classList.add('hidden');
    dropzone.classList.remove('has-file');

    previewUrlEl.textContent = `https://your-site.${MAIN_DOMAIN}`;
    hideError();
    updateSubmitState();

    deploySuccess.classList.add('hidden');
    deployForm.classList.remove('hidden');
  });

});
