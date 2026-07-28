// ═══════════════════════════════════════════════════════
//  Careem AI Talent Advisor — Frontend Application v2.0
// ═══════════════════════════════════════════════════════

// ── Global State ──
let jobDescription = null;
let candidates = [];
let evaluations = {};       // Cached evaluations keyed by candidate_id
let improvements = {};      // Cached improvements keyed by candidate_id
let activeCandidateId = null;
let selectedCandidateIds = new Set();
let allSelected = false;

// ── DOM References ──
const candidatesContainer = document.getElementById('candidates-container');
const emptyState          = document.getElementById('empty-state');
const dashboardView       = document.getElementById('dashboard-view');
const jdModal             = document.getElementById('jd-modal');
const viewJdBtn           = document.getElementById('view-jd-btn');
const closeJdBtn          = document.getElementById('close-jd-btn');
const jdModalBody         = document.getElementById('jd-modal-body');
const batchScreenBtn      = document.getElementById('batch-screen-btn');
const selectAllBtn        = document.getElementById('select-all-btn');

// Detail panel elements
const candidateNameTitle  = document.getElementById('candidate-name-title');
const candidateInitials   = document.getElementById('candidate-initials');
const candidateEmail      = document.getElementById('candidate-email');
const candidateLocation   = document.getElementById('candidate-location');
const overallScoreNum     = document.getElementById('overall-score-num');
const scoreCirclePath     = document.getElementById('score-circle-path');
const statusBadge         = document.getElementById('status-badge');
const evaluationSummary   = document.getElementById('evaluation-summary');
const evaluationDate      = document.getElementById('evaluation-date');
const questionsList       = document.getElementById('questions-list');
const resumeRawText       = document.getElementById('resume-raw-text');
const copyResumeBtn       = document.getElementById('copy-resume-btn');

// Upload elements
const dropzone   = document.getElementById('dropzone');
const fileInput  = document.getElementById('resume-file-input');
const uploadStatus = document.getElementById('upload-status');

// ── Initialization ──
document.addEventListener('DOMContentLoaded', () => {
  fetchLlmConfig();
  fetchJobDescription();
  fetchCandidates();
  setupEventListeners();
});

// ── Event Listeners ──
function setupEventListeners() {
  // Main tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.getAttribute('data-tab')).classList.add('active');
    });
  });

  // JD Modal
  viewJdBtn.addEventListener('click', () => {
    jdModal.classList.remove('hidden');
    switchJdMode('view');
    renderJobDescriptionModal();
  });
  closeJdBtn.addEventListener('click', () => jdModal.classList.add('hidden'));
  jdModal.addEventListener('click', e => { if (e.target === jdModal) jdModal.classList.add('hidden'); });

  // JD Mode tabs (View / Edit / Paste)
  document.getElementById('jd-mode-view-btn')?.addEventListener('click', () => switchJdMode('view'));
  document.getElementById('jd-mode-edit-btn')?.addEventListener('click', () => switchJdMode('edit'));
  document.getElementById('jd-mode-paste-btn')?.addEventListener('click', () => switchJdMode('paste'));

  // JD Edit Form submit
  document.getElementById('jd-edit-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    await saveJobDescription();
  });

  // JD Reset button
  document.getElementById('reset-jd-btn')?.addEventListener('click', async () => {
    if (confirm('Reset to the default Careem Senior Backend Engineer JD?')) {
      await resetJobDescription();
    }
  });

  // Parse pasted JD text
  document.getElementById('parse-jd-btn')?.addEventListener('click', async () => {
    await parsePastedJd();
  });

  // Model provider dropdown
  document.getElementById('llm-provider-select')?.addEventListener('change', e => {
    updateLlmProvider(e.target.value);
  });

  // Batch Screen All / Selected
  batchScreenBtn.addEventListener('click', () => batchScreenAll());

  // Select All toggle
  selectAllBtn?.addEventListener('click', () => {
    allSelected = !allSelected;
    if (allSelected) {
      candidates.forEach(c => selectedCandidateIds.add(c.id));
    } else {
      selectedCandidateIds.clear();
    }
    renderCandidateList();
    updateBatchBtnLabel();
  });

  // Generate Improvement button
  document.getElementById('generate-improvement-btn')?.addEventListener('click', () => {
    if (activeCandidateId) generateImprovements(activeCandidateId);
  });

  // Copy resume content
  copyResumeBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(resumeRawText.textContent).then(() => {
      const orig = copyResumeBtn.innerHTML;
      copyResumeBtn.innerHTML = '<i data-lucide="check"></i> Copied!';
      lucide.createIcons();
      setTimeout(() => { copyResumeBtn.innerHTML = orig; lucide.createIcons(); }, 2000);
    });
  });

  // Drag & Drop upload
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', e => {
    if (e.target.files.length > 0) handleFileUpload(e.target.files[0]);
  });
}

  // Settings Modal
  const settingsModal = document.getElementById('settings-modal');
  const openSettingsBtn = document.getElementById('open-settings-btn');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const cancelSettingsBtn = document.getElementById('cancel-settings-btn');
  const settingsForm = document.getElementById('settings-form');
  const modalProviderSelect = document.getElementById('modal-provider-select');
  const modalModelSelect = document.getElementById('modal-model-select');

  openSettingsBtn?.addEventListener('click', () => openSettingsModal());
  closeSettingsBtn?.addEventListener('click', () => settingsModal?.classList.add('hidden'));
  cancelSettingsBtn?.addEventListener('click', () => settingsModal?.classList.add('hidden'));
  settingsModal?.addEventListener('click', e => { if (e.target === settingsModal) settingsModal.classList.add('hidden'); });

  // Toggle Password Visibility for API Keys
  document.querySelectorAll('.toggle-key-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (input) {
        const isPass = input.type === 'password';
        input.type = isPass ? 'text' : 'password';
        btn.innerHTML = `<i data-lucide="${isPass ? 'eye-off' : 'eye'}"></i>`;
        lucide.createIcons();
      }
    });
  });

  // Modal Provider dropdown change -> Auto-select default model
  modalProviderSelect?.addEventListener('change', e => {
    populateModelSelect(e.target.value);
  });

  // Settings form submit
  settingsForm?.addEventListener('submit', async e => {
    e.preventDefault();
    await saveSettings();
  });
}

// ── LLM Config & Settings ──
const providerModels = {
  mistral: [
    { value: 'mistral-large-latest', label: '✦ Mistral Large (Recommended)' },
    { value: 'mistral-small-latest', label: 'Mistral Small (Fast)' },
    { value: 'codestral-latest', label: 'Codestral (Code Focused)' },
    { value: 'pixtral-12b-2409', label: 'Pixtral 12B (Multimodal)' }
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile', label: '⚡ Llama 3.3 70B (Recommended)' },
    { value: 'llama3-70b-8192', label: 'Llama 3 70B' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' }
  ]
};

function populateModelSelect(provider, selectedModel = null) {
  const modelSelect = document.getElementById('modal-model-select');
  if (!modelSelect) return;
  modelSelect.innerHTML = '';
  const options = providerModels[provider] || providerModels.mistral;
  options.forEach(opt => {
    const el = document.createElement('option');
    el.value = opt.value;
    el.textContent = opt.label;
    modelSelect.appendChild(el);
  });
  if (selectedModel && options.some(o => o.value === selectedModel)) {
    modelSelect.value = selectedModel;
  } else {
    modelSelect.value = options[0].value;
  }
}

function openSettingsModal() {
  const settingsModal = document.getElementById('settings-modal');
  const modalProvider = document.getElementById('modal-provider-select');
  const mistralInput  = document.getElementById('mistral-key-input');
  const groqInput     = document.getElementById('groq-key-input');

  const currentProvider = document.getElementById('llm-provider-select')?.value || 'mistral';
  const savedMistralKey = localStorage.getItem('mistral_api_key') || '';
  const savedGroqKey    = localStorage.getItem('groq_api_key') || '';
  const savedModel      = localStorage.getItem('llm_model') || '';

  if (modalProvider) modalProvider.value = currentProvider;
  if (mistralInput)  mistralInput.value  = savedMistralKey;
  if (groqInput)     groqInput.value     = savedGroqKey;

  populateModelSelect(currentProvider, savedModel);
  settingsModal?.classList.remove('hidden');
}

async function saveSettings() {
  const settingsModal  = document.getElementById('settings-modal');
  const provider       = document.getElementById('modal-provider-select')?.value || 'mistral';
  const model          = document.getElementById('modal-model-select')?.value;
  const mistral_api_key = document.getElementById('mistral-key-input')?.value.trim() || '';
  const groq_api_key    = document.getElementById('groq-key-input')?.value.trim() || '';

  // Save to localStorage
  if (mistral_api_key) localStorage.setItem('mistral_api_key', mistral_api_key);
  else localStorage.removeItem('mistral_api_key');

  if (groq_api_key) localStorage.setItem('groq_api_key', groq_api_key);
  else localStorage.removeItem('groq_api_key');

  localStorage.setItem('llm_provider', provider);
  if (model) localStorage.setItem('llm_model', model);

  // Sync to Backend
  try {
    const res = await fetch('/api/llm-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model, mistral_api_key, groq_api_key })
    });
    if (!res.ok) throw new Error('Failed to update settings');
    const data = await res.json();

    // Update Header Selector
    const headerSelect = document.getElementById('llm-provider-select');
    if (headerSelect) headerSelect.value = data.provider;

    // Reset cached evaluations
    evaluations = {};
    improvements = {};
    renderCandidateList();

    settingsModal?.classList.add('hidden');
    showUploadStatus(`Settings saved! Active Provider: ${data.provider.toUpperCase()} (${data.model})`, 'success');
  } catch (err) {
    showUploadStatus(`Failed to save settings: ${err.message}`, 'error');
  }
}

async function fetchLlmConfig() {
  try {
    const localMistral = localStorage.getItem('mistral_api_key');
    const localGroq    = localStorage.getItem('groq_api_key');
    const localProv    = localStorage.getItem('llm_provider');
    const localModel   = localStorage.getItem('llm_model');

    // If local storage has keys, sync them to backend on load
    if (localMistral || localGroq || localProv) {
      await fetch('/api/llm-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: localProv || 'mistral',
          model: localModel,
          mistral_api_key: localMistral || '',
          groq_api_key: localGroq || ''
        })
      });
    }

    const res = await fetch('/api/llm-config');
    if (!res.ok) return;
    const data = await res.json();
    const select = document.getElementById('llm-provider-select');
    if (select && data.provider) select.value = data.provider;
  } catch (e) {
    console.error('Failed to fetch LLM config:', e);
  }
}

async function updateLlmProvider(provider) {
  showUploadStatus(`Switching AI model to ${provider === 'mistral' ? 'Mistral AI' : 'Groq AI'}...`, 'info');
  try {
    const mistral_api_key = localStorage.getItem('mistral_api_key') || '';
    const groq_api_key    = localStorage.getItem('groq_api_key') || '';
    const defaultModel = provider === 'mistral' ? 'mistral-large-latest' : 'llama-3.3-70b-versatile';

    const res = await fetch('/api/llm-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model: defaultModel, mistral_api_key, groq_api_key })
    });
    if (!res.ok) throw new Error('Failed to update provider');
    const data = await res.json();
    localStorage.setItem('llm_provider', data.provider);
    localStorage.setItem('llm_model', data.model);

    // Clear caches
    evaluations = {};
    improvements = {};
    renderCandidateList();
    showUploadStatus(`Switched to ${data.provider.toUpperCase()} (${data.model})! All evaluations reset.`, 'success');
  } catch (err) {
    showUploadStatus(`Provider switch failed: ${err.message}`, 'error');
  }
}

// ── Job Description ──
async function fetchJobDescription() {
  try {
    const res = await fetch('/api/jd');
    if (!res.ok) throw new Error('Failed to load JD');
    jobDescription = await res.json();
    updateActiveJdPill();
  } catch (e) {
    console.error(e);
  }
}

function updateActiveJdPill() {
  const el = document.getElementById('active-jd-title');
  if (el && jobDescription) {
    el.textContent = `${jobDescription.title} · ${jobDescription.company}`;
  }
}

function renderJobDescriptionModal() {
  if (!jobDescription) {
    jdModalBody.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';
    return;
  }
  jdModalBody.innerHTML = `
    <div class="jd-section">
      <h4>Role Title</h4>
      <p style="font-size:16px;font-weight:600;color:var(--text-main)">${jobDescription.title} at ${jobDescription.company}</p>
      <p style="font-size:12px;color:var(--text-muted)">${jobDescription.department} | ${jobDescription.location}</p>
    </div>
    <div class="jd-section">
      <h4>About the Position</h4>
      <p>${jobDescription.description}</p>
    </div>
    <div class="jd-section">
      <h4>Core Requirements</h4>
      <ul class="jd-list">${jobDescription.requirements.map(r => `<li>${r}</li>`).join('')}</ul>
    </div>
    <div class="jd-section">
      <h4>Preferred Qualifications</h4>
      <ul class="jd-list">${jobDescription.preferred_qualifications.map(p => `<li>${p}</li>`).join('')}</ul>
    </div>
  `;
}

function switchJdMode(mode) {
  const viewBtn   = document.getElementById('jd-mode-view-btn');
  const editBtn   = document.getElementById('jd-mode-edit-btn');
  const pasteBtn  = document.getElementById('jd-mode-paste-btn');
  const viewPane  = document.getElementById('jd-view-pane');
  const editPane  = document.getElementById('jd-edit-pane');
  const pastePane = document.getElementById('jd-paste-pane');

  [viewBtn, editBtn, pasteBtn].forEach(b => b?.classList.remove('active'));
  [viewPane, editPane, pastePane].forEach(p => p?.classList.remove('active'));

  if (mode === 'edit') {
    editBtn?.classList.add('active');
    editPane?.classList.add('active');
    populateJdForm();
  } else if (mode === 'paste') {
    pasteBtn?.classList.add('active');
    pastePane?.classList.add('active');
  } else {
    viewBtn?.classList.add('active');
    viewPane?.classList.add('active');
    renderJobDescriptionModal();
  }
}

function populateJdForm() {
  if (!jobDescription) return;
  document.getElementById('jd-title-input').value   = jobDescription.title || '';
  document.getElementById('jd-company-input').value = jobDescription.company || '';
  document.getElementById('jd-dept-input').value    = jobDescription.department || '';
  document.getElementById('jd-loc-input').value     = jobDescription.location || '';
  document.getElementById('jd-desc-input').value    = jobDescription.description || '';
  document.getElementById('jd-reqs-input').value    = (jobDescription.requirements || []).join('\n');
  document.getElementById('jd-prefs-input').value   = (jobDescription.preferred_qualifications || []).join('\n');
}

async function saveJobDescription() {
  const btn = document.getElementById('save-jd-btn');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;margin-right:6px;"></div> Saving...';

  const payload = {
    title:       document.getElementById('jd-title-input').value.trim(),
    company:     document.getElementById('jd-company-input').value.trim(),
    department:  document.getElementById('jd-dept-input').value.trim(),
    location:    document.getElementById('jd-loc-input').value.trim(),
    description: document.getElementById('jd-desc-input').value.trim(),
    requirements:              document.getElementById('jd-reqs-input').value.split('\n').map(s => s.trim()).filter(Boolean),
    preferred_qualifications:  document.getElementById('jd-prefs-input').value.split('\n').map(s => s.trim()).filter(Boolean)
  };

  try {
    const res = await fetch('/api/jd', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to update JD');
    jobDescription = await res.json();
    updateActiveJdPill();
    evaluations = {};
    improvements = {};
    renderCandidateList();
    switchJdMode('view');
    showUploadStatus('Job Description saved! Evaluation cache reset.', 'success');
  } catch (err) {
    showUploadStatus(`Save failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
    lucide.createIcons();
  }
}

async function resetJobDescription() {
  try {
    const res = await fetch('/api/jd/reset', { method: 'POST' });
    if (!res.ok) throw new Error('Reset failed');
    jobDescription = await res.json();
    updateActiveJdPill();
    evaluations = {};
    improvements = {};
    renderCandidateList();
    populateJdForm();
    switchJdMode('view');
    showUploadStatus('Reset to default Careem JD!', 'success');
  } catch (err) {
    showUploadStatus(`Reset failed: ${err.message}`, 'error');
  }
}

// ── Parse Pasted JD Text ──
async function parsePastedJd() {
  const rawText = document.getElementById('jd-raw-paste')?.value?.trim();
  if (!rawText) {
    showUploadStatus('Please paste some job description text first.', 'error');
    return;
  }

  const btn = document.getElementById('parse-jd-btn');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;margin-right:6px;"></div> Parsing...';

  // Simple heuristic parser — extract lines into fields
  try {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    
    // Extract title: first non-empty line or line containing 'Engineer/Developer/Manager/Analyst'
    let title = lines.find(l => /engineer|developer|manager|analyst|designer|lead|intern/i.test(l)) || lines[0] || '';
    
    // Extract company: look for 'at Company' or 'Company Name:' or a standalone company-like line
    let company = '';
    const atMatch = rawText.match(/\bat\s+([A-Z][A-Za-z\s&.]+?)(?:\s*[\|\-,\n]|$)/m);
    if (atMatch) company = atMatch[1].trim();
    if (!company) company = jobDescription?.company || 'Company';

    // Extract location
    let location = '';
    const locMatch = rawText.match(/(?:Location|Based in|Work location|City)[:\s]+([^\n,]+)/i);
    if (locMatch) location = locMatch[1].trim();
    if (!location) {
      const cityMatch = rawText.match(/\b(Dubai|Riyadh|London|New York|Karachi|Lahore|Islamabad|Remote|San Francisco|Singapore)\b/i);
      if (cityMatch) location = cityMatch[0];
    }
    if (!location) location = jobDescription?.location || 'Not specified';

    // Extract department
    let department = '';
    const deptMatch = rawText.match(/(?:Department|Team|Division)[:\s]+([^\n]+)/i);
    if (deptMatch) department = deptMatch[1].trim();
    if (!department) department = jobDescription?.department || 'Engineering';

    // Requirements: lines after "Requirements" or "Qualifications" section, starting with - or •
    const reqStart = rawText.search(/(?:requirements?|qualifications?|what you.ll (need|bring)|responsibilities?)\s*[:\n]/i);
    let requirements = [];
    if (reqStart !== -1) {
      const reqSection = rawText.slice(reqStart, reqStart + 2000);
      requirements = reqSection.split('\n')
        .map(l => l.replace(/^[\-•\*\d\.]+\s*/, '').trim())
        .filter(l => l.length > 20 && l.length < 300 && !/^(requirements?|qualifications?|responsibilities?|preferred|nice to have)/i.test(l))
        .slice(0, 10);
    }
    if (!requirements.length) requirements = ['See full job description for requirements.'];

    // Preferred: lines after "preferred" or "nice to have"
    const prefStart = rawText.search(/(?:preferred|nice.to.have|bonus|plus)\s*[:\n]/i);
    let preferred = [];
    if (prefStart !== -1) {
      const prefSection = rawText.slice(prefStart, prefStart + 1000);
      preferred = prefSection.split('\n')
        .map(l => l.replace(/^[\-•\*\d\.]+\s*/, '').trim())
        .filter(l => l.length > 15 && l.length < 250)
        .slice(0, 5);
    }
    if (!preferred.length) preferred = ['See full job description for preferred qualifications.'];

    // Description: take first paragraph or first 500 chars
    const description = rawText.slice(0, 600).split('\n\n')[0] || rawText.slice(0, 500);

    // Pre-fill the edit form
    document.getElementById('jd-title-input').value   = title.replace(/[*#_]/g, '').substring(0, 100);
    document.getElementById('jd-company-input').value = company.replace(/[*#_]/g, '').substring(0, 80);
    document.getElementById('jd-dept-input').value    = department.substring(0, 80);
    document.getElementById('jd-loc-input').value     = location.substring(0, 80);
    document.getElementById('jd-desc-input').value    = description.substring(0, 1000);
    document.getElementById('jd-reqs-input').value    = requirements.join('\n');
    document.getElementById('jd-prefs-input').value   = preferred.join('\n');

    // Switch to Edit mode so user can review and adjust
    showUploadStatus('JD parsed! Please review and save.', 'success');
    switchJdMode('edit');
  } catch (err) {
    showUploadStatus(`Parse failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
    lucide.createIcons();
  }
}

// ── Candidates ──
async function fetchCandidates() {
  try {
    const res = await fetch('/api/candidates');
    if (!res.ok) throw new Error('Failed to load candidates');
    candidates = await res.json();
    renderCandidateList();
  } catch (err) {
    candidatesContainer.innerHTML = `<div class="status-msg error">Error loading candidates: ${err.message}</div>`;
  }
}

function renderCandidateList() {
  if (!candidates.length) {
    candidatesContainer.innerHTML = '<p class="card-subtitle">No candidate resumes found.</p>';
    return;
  }

  candidatesContainer.innerHTML = '';
  candidates.forEach(cand => {
    const isEvaluated = !!evaluations[cand.id];
    const evaluation  = evaluations[cand.id];
    const isSelected  = selectedCandidateIds.has(cand.id);
    const scoreVal    = isEvaluated ? evaluation.overall_score : '?';
    const statusClass = isEvaluated ? 'evaluated status-' + evaluation.status.replace(/\s/g, '') : '';

    const el = document.createElement('div');
    el.className = `candidate-item ${activeCandidateId === cand.id ? 'active' : ''} ${statusClass}`;
    el.id = `candidate-item-${cand.id}`;
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        <input type="checkbox" class="candidate-checkbox" ${isSelected ? 'checked' : ''}
          title="Select for batch screening"
          onclick="event.stopPropagation(); toggleCandidateSelect('${cand.id}', this.checked)">
        <div style="min-width:0;">
          <div class="candidate-name">${cand.name}</div>
          <div class="candidate-tag"><i data-lucide="file-text"></i> ${cand.file_name}</div>
        </div>
      </div>
      <div class="candidate-score-badge">${scoreVal}</div>
    `;
    el.addEventListener('click', () => selectCandidate(cand.id));
    candidatesContainer.appendChild(el);
  });
  lucide.createIcons();
}

function toggleCandidateSelect(id, checked) {
  if (checked) {
    selectedCandidateIds.add(id);
  } else {
    selectedCandidateIds.delete(id);
    allSelected = false;
  }
  updateBatchBtnLabel();
}

function updateBatchBtnLabel() {
  const n = selectedCandidateIds.size;
  batchScreenBtn.innerHTML = n > 0
    ? `<i data-lucide="play"></i> Screen ${n} Selected`
    : `<i data-lucide="play"></i> Screen All`;
  lucide.createIcons();
}

// ── Select a Candidate ──
async function selectCandidate(candidateId) {
  activeCandidateId = candidateId;
  renderCandidateList();

  emptyState.classList.add('hidden');
  dashboardView.classList.add('hidden');

  const loader = createLoader();
  emptyState.parentNode.appendChild(loader);

  try {
    const [resumeRes] = await Promise.all([
      fetch(`/api/candidates/${candidateId}`)
    ]);
    if (!resumeRes.ok) throw new Error('Failed to load resume details.');
    const resumeData = await resumeRes.json();

    let evaluation = evaluations[candidateId];
    if (!evaluation) {
      const evalRes = await fetch(`/api/screen/${candidateId}`, { method: 'POST' });
      if (!evalRes.ok) throw new Error('Screening analysis failed.');
      evaluation = await evalRes.json();
      evaluations[candidateId] = evaluation;
      renderCandidateList();
    }

    removeLoader(loader);
    renderEvaluationDashboard(evaluation, resumeData.content);
  } catch (err) {
    removeLoader(loader);
    emptyState.classList.remove('hidden');
    emptyState.innerHTML = `
      <i data-lucide="alert-circle" class="empty-icon" style="color:var(--status-rejected)"></i>
      <h2>Evaluation Failed</h2>
      <p>${err.message}</p>
      <button class="btn btn-secondary" onclick="selectCandidate('${candidateId}')"><i data-lucide="refresh-cw"></i> Retry</button>
    `;
    lucide.createIcons();
  }
}

// ── Render Evaluation Dashboard ──
function renderEvaluationDashboard(evalData, rawResume) {
  dashboardView.classList.remove('hidden');
  emptyState.classList.add('hidden');

  candidateNameTitle.textContent = evalData.candidate_name;
  const initials = evalData.candidate_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  candidateInitials.textContent = initials;

  // Extract contact details
  const emailMatch = rawResume.match(/[\w.\-+]+@[\w.\-]+\.\w{2,}/);
  const locationMatch = rawResume.match(/Location:\s*([^\n,]+)/i)
    || rawResume.match(/\b(Dubai|Riyadh|Karachi|Lahore|Islamabad|London|New York|Singapore|Seattle|Remote|San Francisco|Berlin)\b/i);

  candidateEmail.innerHTML    = `<i data-lucide="mail"></i> ${emailMatch ? emailMatch[0] : 'Not specified'}`;
  candidateLocation.innerHTML = `<i data-lucide="map-pin"></i> ${locationMatch ? (Array.isArray(locationMatch) ? locationMatch[0] : locationMatch[0]) : 'Not specified'}`;

  // Score & status
  overallScoreNum.textContent = evalData.overall_score;
  scoreCirclePath.setAttribute('stroke-dasharray', `${evalData.overall_score}, 100`);

  const statusColorMap = { 'Shortlisted': 'var(--status-shortlisted)', 'Under Review': 'var(--status-review)', 'Rejected': 'var(--status-rejected)' };
  scoreCirclePath.style.stroke = statusColorMap[evalData.status] || 'var(--accent-color)';

  const statusClassMap = { 'Shortlisted': 'Shortlisted', 'Under Review': 'Review', 'Rejected': 'Rejected' };
  statusBadge.className = `status-badge ${statusClassMap[evalData.status] || ''}`;
  statusBadge.textContent = evalData.status;

  // Dimension breakdowns
  updateDimensionScore('backend',   evalData.breakdown.backend_skills);
  updateDimensionScore('design',    evalData.breakdown.system_design);
  updateDimensionScore('databases', evalData.breakdown.real_time_databases);
  updateDimensionScore('devops',    evalData.breakdown.cloud_devops);
  updateDimensionScore('domain',    evalData.breakdown.domain_fit);

  evaluationSummary.textContent = evalData.summary;
  evaluationDate.textContent    = evalData.evaluation_date || 'Just evaluated';

  // Interview Questions
  questionsList.innerHTML = '';
  (evalData.interview_questions || []).forEach((q, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="question-number">Question 0${i + 1}</span><p class="question-text">${q}</p>`;
    questionsList.appendChild(li);
  });

  // Resume source
  resumeRawText.textContent = rawResume;

  // Reset improvement panel
  const panel = document.getElementById('improvement-panel');
  if (panel) {
    panel.innerHTML = `
      <div class="improvement-placeholder">
        <i data-lucide="lightbulb"></i>
        <p>Click <strong>"Generate AI Suggestions"</strong> to get personalized resume improvement advice powered by <strong>Mistral Large</strong>.</p>
      </div>`;
  }

  // Activate first tab
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-tab="screening-tab"]')?.classList.add('active');
  document.getElementById('screening-tab')?.classList.add('active');

  lucide.createIcons();
}

function updateDimensionScore(key, scoreDim) {
  const scoreEl  = document.getElementById(`score-${key}`);
  const fillEl   = document.getElementById(`fill-${key}`);
  const justEl   = document.getElementById(`just-${key}`);

  if (scoreEl && fillEl && justEl) {
    scoreEl.textContent = `${scoreDim.score}/5`;
    fillEl.style.width  = `${scoreDim.score * 20}%`;
    justEl.textContent  = scoreDim.justification;

    if (scoreDim.score >= 4) {
      fillEl.style.background = 'linear-gradient(90deg, var(--accent-color), var(--status-shortlisted))';
    } else if (scoreDim.score >= 3) {
      fillEl.style.background = 'linear-gradient(90deg, var(--status-review), var(--accent-color))';
    } else {
      fillEl.style.background = 'linear-gradient(90deg, var(--status-rejected), var(--status-review))';
    }
  }
}

// ── Resume Improvement Panel ──
async function generateImprovements(candidateId) {
  const panel = document.getElementById('improvement-panel');
  const btn   = document.getElementById('generate-improvement-btn');

  if (improvements[candidateId]) {
    renderImprovementPanel(improvements[candidateId]);
    return;
  }

  btn.disabled = true;
  const origBtnHtml = btn.innerHTML;
  btn.innerHTML = '<div class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;margin-right:6px;"></div> Analyzing...';

  panel.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';

  try {
    const res = await fetch(`/api/improve/${candidateId}`, { method: 'POST' });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || 'Improvement analysis failed.');
    }
    const data = await res.json();
    improvements[candidateId] = data;
    renderImprovementPanel(data);
  } catch (err) {
    panel.innerHTML = `
      <div class="improvement-placeholder">
        <i data-lucide="alert-circle"></i>
        <p>Failed to generate improvements: <strong>${err.message}</strong></p>
      </div>`;
    lucide.createIcons();
  } finally {
    btn.disabled = false;
    btn.innerHTML = origBtnHtml;
    lucide.createIcons();
  }
}

function renderImprovementPanel(data) {
  const panel = document.getElementById('improvement-panel');

  const makeList = (items, sectionClass) => `
    <div class="improvement-section ${sectionClass}">
      <div class="improvement-section-title">
        <i data-lucide="${sectionClass === 'section-strengths' ? 'check-circle-2' : sectionClass === 'section-gaps' ? 'alert-triangle' : sectionClass === 'section-suggestions' ? 'edit-3' : 'trending-up'}"></i>
        ${sectionClass === 'section-strengths' ? '✦ Strengths' : sectionClass === 'section-gaps' ? '⚠ Critical Gaps' : sectionClass === 'section-suggestions' ? '✏ Resume Suggestions' : '🚀 Skills to Build'}
      </div>
      <ul class="improvement-list">
        ${(items || []).map(item => `<li>${item}</li>`).join('')}
      </ul>
    </div>`;

  panel.innerHTML = `
    <div class="improvement-grid">
      ${makeList(data.strengths, 'section-strengths')}
      ${makeList(data.gaps, 'section-gaps')}
    </div>
    <div class="improvement-grid">
      ${makeList(data.suggestions, 'section-suggestions')}
      ${makeList(data.improvements, 'section-improvements')}
    </div>
    <div class="improvement-advice-box">
      <div class="improvement-advice-label"><i data-lucide="star"></i> Overall Career Advice</div>
      ${data.overall_advice || ''}
    </div>
  `;
  lucide.createIcons();
}

// ── Batch Screening ──
async function batchScreenAll() {
  const toScreen = selectedCandidateIds.size > 0
    ? candidates.filter(c => selectedCandidateIds.has(c.id))
    : candidates;

  batchScreenBtn.disabled = true;
  const orig = batchScreenBtn.innerHTML;
  batchScreenBtn.innerHTML = '<div class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;margin-right:6px;"></div> Screening...';

  for (const cand of toScreen) {
    if (!evaluations[cand.id]) {
      try {
        const el = document.getElementById(`candidate-item-${cand.id}`);
        if (el) el.classList.add('active');
        const res = await fetch(`/api/screen/${cand.id}`, { method: 'POST' });
        if (res.ok) {
          evaluations[cand.id] = await res.json();
          renderCandidateList();
        }
      } catch (e) {
        console.error(`Batch error for ${cand.id}`, e);
      }
    }
  }

  batchScreenBtn.disabled = false;
  batchScreenBtn.innerHTML = orig;
  lucide.createIcons();
}

// ── Custom File Upload ──
async function handleFileUpload(file) {
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  const textFormats  = ['.pdf', '.txt', '.md'];
  const imageFormats = ['.jpg', '.jpeg', '.png'];
  const allFormats   = [...textFormats, ...imageFormats];

  if (!allFormats.includes(ext)) {
    showUploadStatus('Unsupported format. Upload PDF, TXT, MD, JPG, or PNG.', 'error');
    return;
  }

  const modelLabel = imageFormats.includes(ext) ? 'Pixtral (Vision)' : 'Mistral Large';
  showUploadStatus(`Processing "${file.name}" via ${modelLabel}...`, 'info');

  emptyState.classList.add('hidden');
  dashboardView.classList.add('hidden');
  const loader = createLoader();
  emptyState.parentNode.appendChild(loader);

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/screen-custom', { method: 'POST', body: formData });
    removeLoader(loader);

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Resume analysis failed.');
    }

    const evaluation = await res.json();

    const customCandidate = {
      id: evaluation.candidate_id,
      name: evaluation.candidate_name,
      file_name: file.name,
      file_type: ext.slice(1)
    };

    evaluations[customCandidate.id] = evaluation;
    const idx = candidates.findIndex(c => c.id === customCandidate.id);
    if (idx !== -1) candidates[idx] = customCandidate;
    else candidates.unshift(customCandidate);

    activeCandidateId = customCandidate.id;
    renderCandidateList();

    // For image uploads show placeholder; for text show actual content
    const imageFormats = ['.jpg', '.jpeg', '.png'];
    let displayContent = `*** ${file.name} — parsed by ${imageFormats.includes(ext) ? 'Pixtral (Vision Model)' : 'Mistral Large'} ***\n\nName: ${evaluation.candidate_name}\nStatus: ${evaluation.status}\n\n${evaluation.summary}`;
    if (!imageFormats.includes(ext) && ext !== '.pdf') {
      const reader = new FileReader();
      reader.onload = e => renderEvaluationDashboard(evaluation, e.target.result);
      reader.readAsText(file);
    } else {
      renderEvaluationDashboard(evaluation, displayContent);
    }

    showUploadStatus(`"${file.name}" screened! Check the Improvement tab for AI coaching.`, 'success');
  } catch (err) {
    removeLoader(loader);
    showUploadStatus(`Screening failed: ${err.message}`, 'error');
    emptyState.classList.remove('hidden');
  }
}

// ── Utility Helpers ──
function showUploadStatus(msg, type) {
  const iconMap = { error: 'alert-circle', success: 'check-circle', info: 'info' };
  uploadStatus.className = `status-msg ${type}`;
  uploadStatus.innerHTML = `<i data-lucide="${iconMap[type] || 'info'}"></i> <span>${msg}</span>`;
  uploadStatus.classList.remove('hidden');
  lucide.createIcons();
  if (type === 'success' || type === 'error') {
    setTimeout(() => uploadStatus.classList.add('hidden'), 6000);
  }
}

function createLoader() {
  const div = document.createElement('div');
  div.className = 'loader-container';
  div.id = 'details-loader';
  div.innerHTML = '<div class="spinner"></div>';
  return div;
}

function removeLoader(loader) {
  loader?.remove();
  const existing = document.getElementById('details-loader');
  existing?.remove();
}
