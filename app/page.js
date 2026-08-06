'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Globe,
  UploadCloud,
  FileArchive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  Zap,
  Server,
  ShieldCheck,
  Trash2,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Rocket,
  PartyPopper,
  Heart
} from 'lucide-react';

export default function Dashboard() {
  const [subdomain, setSubdomain] = useState('');
  const [zipFile, setZipFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Status states: 'idle' | 'deploying' | 'success' | 'error'
  const [status, setStatus] = useState('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [deployedResult, setDeployedResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef(null);

  const MAIN_DOMAIN = 'novabyte-labs.com';

  // Sanitized subdomain preview
  const sanitizedSubdomain = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const previewUrl = sanitizedSubdomain ? `https://${sanitizedSubdomain}.${MAIN_DOMAIN}` : `https://your-site.${MAIN_DOMAIN}`;

  const steps = [
    { title: "Connecting to Whitedev's Server...", desc: 'Checking cPanel domain rules...' },
    { title: 'Creating cPanel Subdomain', desc: 'Provisioning DNS & SSL path...' },
    { title: 'FTP Asset Upload', desc: 'Transferring site.zip package to Server...' },
    { title: 'Server File Extraction', desc: 'Extracting static assets natively...' },
    { title: 'Deployment Live', desc: 'Verifying HTTPS & live endpoints...' },
  ];

  const handleSubdomainChange = (e) => {
    const val = e.target.value;
    // Auto-sanitize on type
    const cleaned = val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    setSubdomain(cleaned);
    if (status === 'error') setStatus('idle');
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setErrorMessage('Please select a valid .zip archive containing your static HTML/CSS/JS files.');
      setStatus('error');
      return;
    }
    setZipFile(file);
    if (status === 'error') setStatus('idle');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDeploy = async (e) => {
    e.preventDefault();

    if (!sanitizedSubdomain || sanitizedSubdomain.length < 3) {
      setErrorMessage('Please enter a subdomain name of at least 3 characters.');
      setStatus('error');
      return;
    }

    if (!zipFile) {
      setErrorMessage('Please upload a .zip file containing your static website.');
      setStatus('error');
      return;
    }

    setStatus('deploying');
    setErrorMessage('');
    setCurrentStep(0);

    // Simulate progress steps during request
    const stepTimer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < steps.length - 2) return prev + 1;
        return prev;
      });
    }, 1800);

    const formData = new FormData();
    formData.append('subdomain', sanitizedSubdomain);
    formData.append('zipFile', zipFile);

    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        body: formData,
      });

      let data;
      const responseText = await response.text();
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseErr) {
        if (!response.ok) {
          if (response.status === 413) {
            const sizeFormatted = formatFileSize(zipFile?.size);
            throw new Error(`File size (${sizeFormatted}) exceeds server upload limits (HTTP 413: Payload Too Large). Cloud serverless platforms limit request uploads to ~5-10MB. Please compress high-resolution images, remove unused media/git folders, or split your files.`);
          } else if (response.status === 504 || response.status === 502) {
            throw new Error(`Deployment timed out on server (HTTP ${response.status}). The FTP transfer took too long or the connection dropped.`);
          }
          throw new Error(`Server returned error status HTTP ${response.status} (${response.statusText || 'Upload Error'}).`);
        }
        throw new Error('Server returned an unexpected non-JSON response.');
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Deployment failed (HTTP ${response.status}). Please verify your site files and try again.`);
      }

      setCurrentStep(steps.length - 1);
      setDeployedResult(data);
      setStatus('success');

    } catch (err) {
      clearInterval(stepTimer);
      setStatus('error');
      setErrorMessage(err.message || 'An unexpected error occurred while deploying your site.');
    }
  };

  const copyToClipboard = () => {
    if (!deployedResult?.liveUrl) return;
    navigator.clipboard.writeText(deployedResult.liveUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const resetForm = () => {
    setSubdomain('');
    setZipFile(null);
    setStatus('idle');
    setCurrentStep(0);
    setErrorMessage('');
    setDeployedResult(null);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <main className="min-h-screen relative flex flex-col items-center justify-between p-4 sm:p-8 md:p-12 overflow-hidden">
      {/* Background ambient lighting effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-sky-600/20 rounded-full blur-[140px] pointer-events-none animate-glow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[160px] pointer-events-none animate-glow" />
      <div className="absolute top-[30%] right-[10%] w-[350px] h-[350px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Grid Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`, backgroundSize: '28px 28px' }}
      />

      <div className="w-full max-w-4xl z-10 flex flex-col gap-8 my-auto">

        {/* Top Branding Header */}
        <header className="flex flex-col items-center text-center space-y-4">

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
            Deploy Static Sites <br className="hidden sm:inline" />
            <span className="gradient-text">Instantly on Whitedev's Servers</span>
          </h1>

          <p className="text-gray-400 text-sm sm:text-base max-w-2xl font-normal leading-relaxed">
            Host your static web projects automatically with zero config. Input your custom subdomain, upload your site archive, and go live with native SSL.
          </p>
        </header>

        {/* Main Card Panel */}
        <div className="glass-panel rounded-3xl p-6 sm:p-10 transition-all duration-300 shadow-2xl">

          {/* STATE 1: IDLE / FORM INPUT */}
          {(status === 'idle' || status === 'error') && (
            <form onSubmit={handleDeploy} className="space-y-8">

              {/* Error Alert Box */}
              {status === 'error' && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-rose-200">Deployment Error</p>
                    <p className="mt-0.5 text-rose-300/90">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Subdomain Input Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="subdomain-input" className="block text-sm font-semibold text-gray-200 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    Target Subdomain Name
                  </label>
                  <span className="text-xs text-gray-400 font-mono">.novabyte-labs.com</span>
                </div>

                <div className="relative flex items-center">
                  <input
                    id="subdomain-input"
                    type="text"
                    value={subdomain}
                    onChange={handleSubdomainChange}
                    placeholder="e.g. my-portfolio, myproject"
                    required
                    maxLength={30}
                    className="w-full glass-input rounded-xl px-4 py-3.5 text-base font-mono placeholder:text-gray-500 pr-40"
                  />
                  <div className="absolute right-3 hidden sm:flex items-center px-3 py-1 rounded-lg bg-gray-900/80 border border-gray-700/50 text-xs text-cyan-400 font-mono">
                    .{MAIN_DOMAIN}
                  </div>
                </div>

                {/* Subdomain URL Live Preview Pill */}
                <div className="flex items-center gap-2 text-xs font-mono text-gray-400 bg-gray-900/40 p-2.5 rounded-xl border border-gray-800/60">
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Live Preview:</span>
                  <span className="text-cyan-300 font-medium truncate">{previewUrl}</span>
                </div>
              </div>

              {/* ZIP File Upload Zone */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-200 flex items-center gap-2">
                  <FileArchive className="w-4 h-4 text-indigo-400" />
                  Static Website Package (.ZIP)
                </label>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${isDragging
                    ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
                    : zipFile
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : 'border-gray-700/60 bg-gray-900/30 hover:border-indigo-500/40 hover:bg-indigo-950/20'
                    }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip,application/zip,application/x-zip-compressed"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                    className="hidden"
                  />

                  {zipFile ? (
                    <div className="flex items-center justify-between w-full max-w-md p-3.5 rounded-xl bg-gray-900/80 border border-emerald-500/40 text-emerald-300">
                      <div className="flex items-center gap-3 truncate">
                        <FileArchive className="w-6 h-6 text-emerald-400 shrink-0" />
                        <div className="truncate">
                          <p className="text-sm font-medium text-gray-100 truncate">{zipFile.name}</p>
                          <p className="text-xs text-gray-400 font-mono">{formatFileSize(zipFile.size)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setZipFile(null);
                        }}
                        className="p-1.5 rounded-lg hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-200">
                          <span className="text-indigo-400 hover:underline">Click to browse</span> or drag and drop your .zip file
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Supports index.html, CSS, JS, images (Max 50MB)</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!sanitizedSubdomain || !zipFile}
                className="w-full gradient-button text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2.5 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Deploy Website Now</span>
                <ArrowRight className="w-5 h-5" />
              </button>

            </form>
          )}

          {/* STATE 2: DEPLOYING / PROGRESS TRACKER */}
          {status === 'deploying' && (
            <div className="py-6 space-y-8 animate-in fade-in duration-300">
              <div className="text-center space-y-2">
                <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-indigo-400 animate-spin" />
                  <Server className="w-7 h-7 text-indigo-300" />
                </div>
                <h3 className="text-xl font-bold text-gray-100">Deploying Your Site...</h3>
                <p className="text-sm text-gray-400 font-mono">
                  https://<span className="text-cyan-400">{sanitizedSubdomain}</span>.{MAIN_DOMAIN}
                </p>
              </div>

              {/* Stepper Display */}
              <div className="space-y-3 max-w-md mx-auto">
                {steps.map((step, idx) => {
                  const isDone = idx < currentStep;
                  const isCurrent = idx === currentStep;
                  const isPending = idx > currentStep;

                  return (
                    <div
                      key={step.title}
                      className={`flex items-center gap-4 p-3.5 rounded-xl border transition-all ${isDone
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : isCurrent
                          ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-200 ring-1 ring-indigo-500/30'
                          : 'bg-gray-900/30 border-gray-800 text-gray-500'
                        }`}
                    >
                      <div className="shrink-0">
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : isCurrent ? (
                          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-gray-700 flex items-center justify-center text-xs text-gray-600 font-mono">
                            {idx + 1}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight">{step.title}</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* STATE 3: SUCCESS VIEW */}
          {status === 'success' && deployedResult && (
            <div className="py-4 space-y-8 text-center animate-in zoom-in-95 duration-500">
              
              {/* Premium Multi-Ring Shockwave Success Animation */}
              <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                {/* Outer Expanding Shockwave Ring */}
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 border border-emerald-400/50 animate-ripple pointer-events-none" />
                
                {/* Rotating Dashed Orbit Ring */}
                <div className="absolute -inset-3 rounded-full border border-dashed border-emerald-400/40 animate-spin-slow pointer-events-none" />

                {/* Floating Orbiting Sparkles */}
                <div className="absolute -top-2 -right-2 p-1.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 animate-float-1">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="absolute -bottom-1 -left-2 p-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 animate-float-2">
                  <Rocket className="w-3.5 h-3.5" />
                </div>
                <div className="absolute top-1/2 -right-4 -translate-y-1/2 p-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 animate-float-3">
                  <PartyPopper className="w-3.5 h-3.5" />
                </div>

                {/* Inner Core Glass Badge */}
                <div className="relative z-10 w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-600/40 via-teal-500/30 to-cyan-500/40 border-2 border-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.4)] backdrop-blur-md flex items-center justify-center text-emerald-300 animate-in zoom-in-50 duration-500">
                  <CheckCircle2 className="w-12 h-12 text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 text-xs font-semibold border border-emerald-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Native cPanel SSL & HTTPS Active</span>
                </div>
                <h3 className="text-3xl sm:text-4xl font-extrabold text-white">Your Website is Live!</h3>
                <p className="text-gray-400 text-sm max-w-md mx-auto">
                  Subdomain created and static assets extracted natively on server.
                </p>
              </div>

              {/* URL Display Card */}
              <div className="p-4 sm:p-6 rounded-2xl bg-gray-950/80 border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-lg mx-auto">
                <div className="flex items-center gap-3 text-left overflow-hidden w-full">
                  <Globe className="w-6 h-6 text-cyan-400 shrink-0" />
                  <div className="truncate">
                    <p className="text-xs text-gray-400 font-mono">Live Subdomain URL</p>
                    <a
                      href={deployedResult.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base sm:text-lg font-bold font-mono text-cyan-300 hover:underline truncate block"
                    >
                      {deployedResult.liveUrl}
                    </a>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium text-xs flex items-center justify-center gap-2 border border-gray-700 transition-colors shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto pt-2">
                <a
                  href={deployedResult.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-1/2 gradient-button text-white font-semibold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 text-sm"
                >
                  <span>Open Live Site</span>
                  <ExternalLink className="w-4 h-4" />
                </a>

                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full sm:w-1/2 bg-gray-900/80 hover:bg-gray-800 text-gray-300 font-semibold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 text-sm border border-gray-700/60 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Deploy Another</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <footer className="flex flex-col sm:flex-row items-center justify-center gap-3 text-xs text-gray-400 text-center font-mono pt-2">
          <div className="p-2.5 px-4 rounded-xl bg-gray-950/40 border border-gray-900 flex items-center justify-center gap-2">
            <Server className="w-3.5 h-3.5 text-indigo-400" />
            <span>Server: node243.r-usdatacenter</span>
          </div>
          <span className="hidden sm:inline text-gray-700">•</span>
          <div className="flex items-center gap-1.5 text-gray-400 font-sans text-xs">
            <span>Made by</span>
            <span className="font-semibold text-gray-200">Kavindu Irosha</span>
            <span>with</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse" />
          </div>
        </footer>

      </div>
    </main>
  );
}
