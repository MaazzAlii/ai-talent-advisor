// ---------------------------------------------------------------------------
// Careem Resume Desk -- frontend
//
// This app holds ALL state client-side: API keys, the active Job Description,
// converted resume text, scores, and feedback. The backend is stateless (a
// requirement for running as a Vercel Function) -- every request carries
// whatever context it needs (job_description, resume_markdown, provider) plus
// the person's own API key in a request header. Nothing is persisted server-side.
// ---------------------------------------------------------------------------

const STORAGE_KEYS = {
  groqKey: 'careem_rd_groq_key',
  mistralKey: 'careem_rd_mistral_key',
  provider: 'careem_rd_provider',
  jobDescription: 'careem_rd_job_description',
};

// Global state
let apiKeys = { groq: '', mistral: '' };
let provider = 'groq';
let defaultJobDescription = null;
let jobDescription = null;
let candidates = [];
let resumeCache = {};      // candidate_id -> markdown content
let evaluations = {};      // candidate_id -> evaluation result
let feedbackCache = {};    // candidate_id -> feedback result
let activeCandidateId = null;
let selectedIds = new Set();

class ApiKeyRequiredError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ApiKeyRequiredError';
  }
}

// DOM Elements
const candidatesContainer = document.getElementById('candidates-container');
const emptyState = document.getElementById('empty-state');
const dashboardView = document.getElementById('dashboard-view');
const jdModal = document.getElementById('jd-modal');
const viewJdBtn = document.getElementById('view-jd-btn');
const closeJdBtn = document.getElementById('close-jd-btn');
const jdModalBody = document.getElementById('jd-modal-body');
const batchScreenBtn = document.getElementById('batch-screen-btn');
const screenSelectedBtn = document.getElementById('screen-selected-btn');
const selectAllCheckbox = document.getElementById('select-all-checkbox');
const feedbackContent = document.getElementById('feedback-content');

const settingsModal = document.getElementById('settings-modal');
const openSettingsBtn = document.getElementById('open-settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const settingsForm = document.getElementById('settings-form');
const groqKeyInput = document.getElementById('groq-key-input');
const mistralKeyInput = document.getElementById('mistral-key-input');
const clearKeysBtn = document.getElementById('clear-keys-btn');
const keyBanner = document.getElementById('key-banner');
const keyBannerBtn = document.getElementById('key-banner-btn');

// Detail elements
const candidateNameTitle = document.getElementById('candidate-name-title');
const candidateInitials = document.getElementById('candidate-initials');
const candidateEmail = document.getElementById('candidate-email');
const candidateLocation = document.getElementById('candidate-location');
const overallScoreNum = document.getElementById('overall-score-num');
const scoreCirclePath = document.getElementById('score-circle-path');
const statusBadge = document.getElementById('status-badge');
const evaluationSummary = document.getElementById('evaluation-summary');
const evaluationDate = document.getElementById('evaluation-date');
const questionsList = document.getElementById('questions-list');
const resumeRawText = document.getElementById('resume-raw-text');
const copyResumeBtn = document.getElementById('copy-resume-btn');

// Upload elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('resume-file-input');
const uploadStatus = document.getElementById('upload-status');

// ------------------------------------------------------------------ Init ----

document.addEventListener('DOMContentLoaded', async () => {
  loadKeysFromStorage();
  loadProviderFromStorage();
  updateKeyBannerVisibility();
  setupEventListeners();
  await loadJobDescription();
  await fetchCandidates();
});

function setupEventListeners() {
  // Tabs navigation
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
  jdModal.addEventListener('click', (e) => { if (e.target === jdModal) jdModal.classList.add('hidden'); });

  const jdViewTab = document.getElementById('jd-mode-view-btn');
  const jdEditTab = document.getElementById('jd-mode-edit-btn');
  if (jdViewTab && jdEditTab) {
    jdViewTab.addEventListener('click', () => switchJdMode('view'));
    jdEditTab.addEventListener('click', () => switchJdMode('edit'));
  }

  const jdEditForm = document.getElementById('jd-edit-form');
  if (jdEditForm) {
    jdEditForm.addEventListener('submit', (e) => { e.preventDefault(); saveJobDescription(); });
  }

  const resetJdBtn = document.getElementById('reset-jd-btn');
  if (resetJdBtn) {
    resetJdBtn.addEventListener('click', () => {
      if (confirm('Reset to the default Careem Senior Backend Engineer JD? This clears cached scores.')) {
        resetJobDescription();
      }
    });
  }

  // Settings modal (API keys)
  const openSettings = () => {
    groqKeyInput.value = apiKeys.groq;
    mistralKeyInput.value = apiKeys.mistral;
    settingsModal.classList.remove('hidden');
    lucide.createIcons();
  };
  openSettingsBtn.addEventListener('click', openSettings);
  if (keyBannerBtn) keyBannerBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
  settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) settingsModal.classList.add('hidden'); });

  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    apiKeys.groq = groqKeyInput.value.trim();
    apiKeys.mistral = mistralKeyInput.value.trim();
    localStorage.setItem(STORAGE_KEYS.groqKey, apiKeys.groq);
    localStorage.setItem(STORAGE_KEYS.mistralKey, apiKeys.mistral);
    updateKeyBannerVisibility();
    settingsModal.classList.add('hidden');
    showUploadStatus('API keys saved to this browser.', 'success');
  });

  clearKeysBtn.addEventListener('click', () => {
    apiKeys = { groq: '', mistral: '' };
    localStorage.removeItem(STORAGE_KEYS.groqKey);
    localStorage.removeItem(STORAGE_KEYS.mistralKey);
    groqKeyInput.value = '';
    mistralKeyInput.value = '';
    updateKeyBannerVisibility();
    showUploadStatus('API keys cleared from this browser.', 'info');
  });

  // Model/provider selector
  const providerSelect = document.getElementById('llm-provider-select');
  if (providerSelect) {
    providerSelect.value = provider;
    providerSelect.addEventListener('change', (e) => {
      provider = e.target.value;
      localStorage.setItem(STORAGE_KEYS.provider, provider);
      evaluations = {};
      feedbackCache = {};
      renderCandidateList();
      showUploadStatus(`Switched to ${provider === 'groq' ? 'Groq (GPT-OSS 120B)' : 'Mistral AI (Mistral Large)'}.`, 'info');
    });
  }

  // Batch screening
  batchScreenBtn.addEventListener('click', () => batchScreenAll());
  if (screenSelectedBtn) {
    screenSelectedBtn.addEventListener('click', () => batchScreenAll(Array.from(selectedIds)));
  }
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      selectedIds = e.target.checked ? new Set(candidates.map(c => c.id)) : new Set();
      renderCandidateList();
    });
  }

  // Resume-improvement feedback (event delegation -- button is replaced dynamically)
  if (feedbackContent) {
    feedbackContent.addEventListener('click', (e) => {
      if (e.target.closest('#generate-feedback-btn')) generateResumeFeedback();
    });
  }

  // Copy resume content
  copyResumeBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(resumeRawText.textContent).then(() => {
      const originalText = copyResumeBtn.innerHTML;
      copyResumeBtn.innerHTML = '<i data-lucide="check"></i> Copied!';
      lucide.createIcons();
      setTimeout(() => { copyResumeBtn.innerHTML = originalText; lucide.createIcons(); }, 2000);
    });
  });

  // Drag and drop upload
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFileUpload(e.target.files[0]);
  });
}

// -------------------------------------------------------------- API keys ----

function loadKeysFromStorage() {
  apiKeys.groq = localStorage.getItem(STORAGE_KEYS.groqKey) || '';
  apiKeys.mistral = localStorage.getItem(STORAGE_KEYS.mistralKey) || '';
}

function loadProviderFromStorage() {
  provider = localStorage.getItem(STORAGE_KEYS.provider) || 'groq';
}

function hasAnyKey() {
  return Boolean(apiKeys.groq || apiKeys.mistral);
}

function hasKeyForProvider(p) {
  return p === 'groq' ? Boolean(apiKeys.groq) : Boolean(apiKeys.mistral);
}

function updateKeyBannerVisibility() {
  if (!keyBanner) return;
  keyBanner.classList.toggle('hidden', hasAnyKey());
}

function authHeaders(extra = {}) {
  const headers = { ...extra };
  if (apiKeys.groq) headers['X-Groq-Key'] = apiKeys.groq;
  if (apiKeys.mistral) headers['X-Mistral-Key'] = apiKeys.mistral;
  return headers;
}

// ---------------------------------------------------------- Networking -----

async function apiFetch(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const errData = await response.json();
      if (errData.detail) detail = errData.detail;
    } catch (_) { /* ignore */ }
    if (response.status === 401) throw new ApiKeyRequiredError(detail);
    throw new Error(detail);
  }
  return response.json();
}

// --------------------------------------------------------- Job Description --

async function loadJobDescription() {
  try {
    defaultJobDescription = await apiFetch('/api/jd/default');
  } catch (e) {
    console.error('Failed to load default JD:', e);
  }

  const stored = localStorage.getItem(STORAGE_KEYS.jobDescription);
  if (stored) {
    try {
      jobDescription = JSON.parse(stored);
    } catch (_) {
      jobDescription = defaultJobDescription;
    }
  } else {
    jobDescription = defaultJobDescription;
  }
  updateActiveJdPill();
}

function updateActiveJdPill() {
  const activeJdTitle = document.getElementById('active-jd-title');
  if (activeJdTitle && jobDescription) {
    activeJdTitle.textContent = `${jobDescription.title} (${jobDescription.company})`;
  }
}

function renderJobDescriptionModal() {
  if (!jobDescription) {
    jdModalBody.innerHTML = '<div class="spinner"></div>';
    return;
  }
  jdModalBody.innerHTML = `
    <div class="jd-section">
      <h4>Role Title</h4>
      <p style="font-size:16px;font-weight:600;color:var(--text-main);">${jobDescription.title} at ${jobDescription.company}</p>
      <p style="font-size:12px;color:var(--text-muted);">${jobDescription.department} | ${jobDescription.location}</p>
    </div>
    <div class="jd-section">
      <h4>About the Position</h4>
      <p>${jobDescription.description}</p>
    </div>
    <div class="jd-section">
      <h4>Core Requirements</h4>
      <ul class="jd-list">${jobDescription.requirements.map(req => `<li>${req}</li>`).join('')}</ul>
    </div>
    <div class="jd-section">
      <h4>Preferred Qualifications</h4>
      <ul class="jd-list">${jobDescription.preferred_qualifications.map(pref => `<li>${pref}</li>`).join('')}</ul>
    </div>
  `;
}

function switchJdMode(mode) {
  const jdViewTab = document.getElementById('jd-mode-view-btn');
  const jdEditTab = document.getElementById('jd-mode-edit-btn');
  const jdViewPane = document.getElementById('jd-view-pane');
  const jdEditPane = document.getElementById('jd-edit-pane');

  if (mode === 'edit') {
    jdViewTab.classList.remove('active');
    jdEditTab.classList.add('active');
    jdViewPane.classList.remove('active');
    jdEditPane.classList.add('active');
    populateJdForm();
  } else {
    jdEditTab.classList.remove('active');
    jdViewTab.classList.add('active');
    jdEditPane.classList.remove('active');
    jdViewPane.classList.add('active');
    renderJobDescriptionModal();
  }
}

function populateJdForm() {
  if (!jobDescription) return;
  document.getElementById('jd-title-input').value = jobDescription.title || '';
  document.getElementById('jd-company-input').value = jobDescription.company || '';
  document.getElementById('jd-dept-input').value = jobDescription.department || '';
  document.getElementById('jd-loc-input').value = jobDescription.location || '';
  document.getElementById('jd-desc-input').value = jobDescription.description || '';
  document.getElementById('jd-reqs-input').value = (jobDescription.requirements || []).join('\n');
  document.getElementById('jd-prefs-input').value = (jobDescription.preferred_qualifications || []).join('\n');
}

function saveJobDescription() {
  const saveBtn = document.getElementById('save-jd-btn');
  const originalText = saveBtn.innerHTML;

  jobDescription = {
    title: document.getElementById('jd-title-input').value.trim(),
    company: document.getElementById('jd-company-input').value.trim(),
    department: document.getElementById('jd-dept-input').value.trim(),
    location: document.getElementById('jd-loc-input').value.trim(),
    description: document.getElementById('jd-desc-input').value.trim(),
    requirements: document.getElementById('jd-reqs-input').value.split('\n').map(s => s.trim()).filter(Boolean),
    preferred_qualifications: document.getElementById('jd-prefs-input').value.split('\n').map(s => s.trim()).filter(Boolean),
  };

  localStorage.setItem(STORAGE_KEYS.jobDescription, JSON.stringify(jobDescription));
  updateActiveJdPill();

  // Cached scores/feedback were computed against the old JD -- invalidate them.
  evaluations = {};
  feedbackCache = {};
  renderCandidateList();

  switchJdMode('view');
  showUploadStatus('Job Description saved in this browser. Candidate scores will be recalculated.', 'success');
  saveBtn.innerHTML = originalText;
}

function resetJobDescription() {
  jobDescription = defaultJobDescription;
  localStorage.setItem(STORAGE_KEYS.jobDescription, JSON.stringify(jobDescription));
  updateActiveJdPill();
  evaluations = {};
  feedbackCache = {};
  renderCandidateList();
  populateJdForm();
  switchJdMode('view');
  showUploadStatus('Job Description reset to the Careem default.', 'success');
}

// ------------------------------------------------------------- Candidates ---

async function fetchCandidates() {
  try {
    candidates = await apiFetch('/api/candidates');
    renderCandidateList();
  } catch (error) {
    candidatesContainer.innerHTML = `<div class="status-msg error">Error loading candidates: ${error.message}</div>`;
  }
}

function renderCandidateList() {
  if (candidates.length === 0) {
    candidatesContainer.innerHTML = '<p class="card-subtitle">No candidate resumes found.</p>';
    return;
  }

  candidatesContainer.innerHTML = '';
  candidates.forEach(cand => {
    const isEvaluated = evaluations[cand.id] !== undefined;
    const evaluation = evaluations[cand.id];

    const element = document.createElement('div');
    element.className = `candidate-item ${activeCandidateId === cand.id ? 'active' : ''} ${isEvaluated ? 'evaluated status-' + evaluation.status : ''}`;
    element.id = `candidate-item-${cand.id}`;

    const scoreVal = isEvaluated ? evaluation.overall_score : '—';
    const isChecked = selectedIds.has(cand.id);

    element.innerHTML = `
      <input type="checkbox" class="candidate-select-checkbox" data-id="${cand.id}" ${isChecked ? 'checked' : ''}>
      <div class="candidate-item-main">
        <div class="candidate-name">${cand.name}</div>
        <div class="candidate-tag">
          <i data-lucide="file-text"></i> ${cand.file_name}
        </div>
      </div>
      <div class="candidate-score-badge">${scoreVal}</div>
    `;

    const checkbox = element.querySelector('.candidate-select-checkbox');
    checkbox.addEventListener('click', (e) => e.stopPropagation());
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) selectedIds.add(cand.id); else selectedIds.delete(cand.id);
      updateScreenSelectedBtnState();
    });

    element.querySelector('.candidate-item-main').addEventListener('click', () => selectCandidate(cand.id));
    element.querySelector('.candidate-score-badge').addEventListener('click', () => selectCandidate(cand.id));
    candidatesContainer.appendChild(element);
  });
  lucide.createIcons();
  updateScreenSelectedBtnState();
}

function updateScreenSelectedBtnState() {
  if (!screenSelectedBtn) return;
  screenSelectedBtn.disabled = selectedIds.size === 0;
  screenSelectedBtn.innerHTML = `<i data-lucide="check-square"></i> Screen Selected${selectedIds.size ? ` (${selectedIds.size})` : ''}`;
  lucide.createIcons();
}

// Ensures resumeCache[id] is populated (fetches bundled sample content if needed)
async function ensureResumeContent(candidateId) {
  if (resumeCache[candidateId]) return resumeCache[candidateId];
  const data = await apiFetch(`/api/candidates/${candidateId}`);
  resumeCache[candidateId] = data.content;
  return data.content;
}

async function screenResume(candidateId, resumeName, resumeMarkdown) {
  const evaluation = await apiFetch('/api/screen', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      resume_markdown: resumeMarkdown,
      resume_name: resumeName,
      job_description: jobDescription,
      provider,
    }),
  });
  evaluations[candidateId] = evaluation;
  return evaluation;
}

async function selectCandidate(candidateId) {
  activeCandidateId = candidateId;
  renderCandidateList();

  emptyState.classList.add('hidden');
  dashboardView.classList.add('hidden');
  const spinnerContainer = document.createElement('div');
  spinnerContainer.className = 'loader-container';
  spinnerContainer.id = 'details-loader';
  spinnerContainer.innerHTML = '<div class="spinner"></div>';
  emptyState.parentNode.appendChild(spinnerContainer);

  try {
    const cand = candidates.find(c => c.id === candidateId);
    const content = await ensureResumeContent(candidateId);

    if (!hasKeyForProvider(provider) && !evaluations[candidateId]) {
      throw new ApiKeyRequiredError(`No ${provider === 'groq' ? 'Groq' : 'Mistral'} API key configured.`);
    }

    let evaluation = evaluations[candidateId];
    if (!evaluation) {
      evaluation = await screenResume(candidateId, cand ? cand.name : candidateId, content);
      renderCandidateList();
    }

    document.getElementById('details-loader')?.remove();
    renderEvaluationDashboard(evaluation, content);
  } catch (error) {
    document.getElementById('details-loader')?.remove();
    renderSelectionError(candidateId, error);
  }
}

function renderSelectionError(candidateId, error) {
  emptyState.classList.remove('hidden');
  if (error instanceof ApiKeyRequiredError) {
    emptyState.innerHTML = `
      <i data-lucide="key-round" class="empty-icon" style="color:var(--status-review)"></i>
      <h2>API Key Needed</h2>
      <p>${error.message}</p>
      <button class="btn btn-primary" id="empty-open-settings-btn"><i data-lucide="settings-2"></i> Add API Key</button>
    `;
    lucide.createIcons();
    document.getElementById('empty-open-settings-btn').addEventListener('click', () => openSettingsBtn.click());
  } else {
    emptyState.innerHTML = `
      <i data-lucide="alert-circle" class="empty-icon" style="color:var(--status-rejected)"></i>
      <h2>Evaluation Failed</h2>
      <p>${error.message}</p>
      <button class="btn btn-secondary" id="empty-retry-btn"><i data-lucide="refresh-cw"></i> Retry</button>
    `;
    lucide.createIcons();
    document.getElementById('empty-retry-btn').addEventListener('click', () => selectCandidate(candidateId));
  }
}

function renderEvaluationDashboard(evalData, rawResumeContent) {
  dashboardView.classList.remove('hidden');
  emptyState.classList.add('hidden');

  candidateNameTitle.textContent = evalData.candidate_name;
  const initials = evalData.candidate_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  candidateInitials.textContent = initials;

  const emailMatch = rawResumeContent.match(/[\w.-]+@[\w.-]+\.\w+/);
  const locationMatch = rawResumeContent.match(/Location:\s*(.*)/i) || rawResumeContent.match(/Dubai|Saudi Arabia|Singapore|Seattle|San Francisco/i);

  candidateEmail.innerHTML = `<i data-lucide="mail"></i> ${emailMatch ? emailMatch[0] : 'Not specified'}`;
  candidateLocation.innerHTML = `<i data-lucide="map-pin"></i> ${locationMatch ? (Array.isArray(locationMatch) ? locationMatch[0] : locationMatch) : 'Not specified'}`;

  overallScoreNum.textContent = evalData.overall_score;
  scoreCirclePath.setAttribute('stroke-dasharray', `${evalData.overall_score}, 100`);

  if (evalData.status === 'Shortlisted') scoreCirclePath.style.stroke = 'var(--status-shortlisted)';
  else if (evalData.status === 'Under Review') scoreCirclePath.style.stroke = 'var(--status-review)';
  else scoreCirclePath.style.stroke = 'var(--status-rejected)';

  statusBadge.className = `status-badge ${evalData.status.replace(' ', '')}`;
  statusBadge.textContent = evalData.status;

  updateDimensionScore('backend', evalData.breakdown.backend_skills);
  updateDimensionScore('design', evalData.breakdown.system_design);
  updateDimensionScore('databases', evalData.breakdown.real_time_databases);
  updateDimensionScore('devops', evalData.breakdown.cloud_devops);
  updateDimensionScore('domain', evalData.breakdown.domain_fit);

  evaluationSummary.textContent = evalData.summary;
  evaluationDate.textContent = evalData.evaluation_date || 'Just evaluated';

  questionsList.innerHTML = '';
  evalData.interview_questions.forEach((q, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="question-number">Question 0${idx + 1}</span><p class="question-text">${q}</p>`;
    questionsList.appendChild(li);
  });

  resumeRawText.textContent = rawResumeContent;

  const cachedFeedback = feedbackCache[evalData.candidate_id];
  if (cachedFeedback) {
    renderFeedback(cachedFeedback);
  } else {
    feedbackContent.innerHTML = `<button id="generate-feedback-btn" class="btn btn-primary"><i data-lucide="wand-2"></i> Generate Suggestions</button>`;
  }

  lucide.createIcons();
}

async function generateResumeFeedback() {
  if (!activeCandidateId) return;

  if (!hasKeyForProvider(provider)) {
    feedbackContent.innerHTML = `
      <div class="inline-error"><i data-lucide="key-round"></i> <span>No ${provider === 'groq' ? 'Groq' : 'Mistral'} API key configured.</span></div>
      <button class="btn btn-primary" id="feedback-open-settings-btn" style="margin-top:12px;"><i data-lucide="settings-2"></i> Add API Key</button>
    `;
    lucide.createIcons();
    document.getElementById('feedback-open-settings-btn').addEventListener('click', () => openSettingsBtn.click());
    return;
  }

  feedbackContent.innerHTML = `<div class="loader-container"><div class="spinner"></div></div>`;

  try {
    const content = await ensureResumeContent(activeCandidateId);
    const feedback = await apiFetch('/api/feedback', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ resume_markdown: content, job_description: jobDescription, provider }),
    });
    feedbackCache[activeCandidateId] = feedback;
    renderFeedback(feedback);
  } catch (error) {
    feedbackContent.innerHTML = `
      <div class="status-msg error"><i data-lucide="alert-circle"></i> <span>${error.message}</span></div>
      <button id="generate-feedback-btn" class="btn btn-secondary" style="margin-top:12px;"><i data-lucide="refresh-cw"></i> Retry</button>
    `;
    lucide.createIcons();
  }
}

function renderFeedback(feedback) {
  const strengths = (feedback.strengths || []).map(s => `<li>${s}</li>`).join('');
  const improvements = (feedback.improvement_areas || []).map(item => `
    <div class="improvement-item">
      <p class="improvement-issue"><i data-lucide="alert-triangle"></i> ${item.issue}</p>
      <p class="improvement-suggestion"><i data-lucide="arrow-right"></i> ${item.suggestion}</p>
    </div>
  `).join('');
  const nonConflicting = (feedback.non_conflicting_notes || []).map(s => `<li>${s}</li>`).join('');
  const keywordGaps = (feedback.keyword_gaps || []).map(k => `<span class="keyword-pill">${k}</span>`).join('');

  feedbackContent.innerHTML = `
    ${feedback.strengths && feedback.strengths.length ? `
      <div class="feedback-section"><h4><i data-lucide="thumbs-up"></i> Strengths</h4><ul class="jd-list">${strengths}</ul></div>` : ''}
    ${feedback.improvement_areas && feedback.improvement_areas.length ? `
      <div class="feedback-section"><h4><i data-lucide="edit-3"></i> Areas to Improve</h4>${improvements}</div>` : ''}
    ${feedback.keyword_gaps && feedback.keyword_gaps.length ? `
      <div class="feedback-section"><h4><i data-lucide="tag"></i> Missing Keywords for This Role</h4><div class="keyword-pill-container">${keywordGaps}</div></div>` : ''}
    ${feedback.non_conflicting_notes && feedback.non_conflicting_notes.length ? `
      <div class="feedback-section"><h4><i data-lucide="check"></i> Fine As-Is</h4><ul class="jd-list">${nonConflicting}</ul></div>` : ''}
    ${feedback.overall_advice ? `
      <div class="feedback-section overall-advice"><h4><i data-lucide="lightbulb"></i> Overall Advice</h4><p>${feedback.overall_advice}</p></div>` : ''}
    <button id="generate-feedback-btn" class="btn btn-secondary btn-sm" style="margin-top:8px;"><i data-lucide="refresh-cw"></i> Regenerate</button>
  `;
  lucide.createIcons();
}

function updateDimensionScore(key, scoreDim) {
  const scoreElement = document.getElementById(`score-${key}`);
  const fillElement = document.getElementById(`fill-${key}`);
  const justificationElement = document.getElementById(`just-${key}`);
  if (!scoreElement || !fillElement || !justificationElement) return;

  scoreElement.textContent = `${scoreDim.score}/5`;
  fillElement.style.width = `${scoreDim.score * 20}%`;
  justificationElement.textContent = scoreDim.justification;

  if (scoreDim.score >= 4) fillElement.style.background = 'linear-gradient(90deg, var(--accent-color), var(--status-shortlisted))';
  else if (scoreDim.score >= 3) fillElement.style.background = 'linear-gradient(90deg, var(--status-review), var(--accent-color))';
  else fillElement.style.background = 'linear-gradient(90deg, var(--status-rejected), var(--status-review))';
}

async function batchScreenAll(onlyIds = null) {
  if (!hasKeyForProvider(provider)) {
    showUploadStatus(`Add a ${provider === 'groq' ? 'Groq' : 'Mistral'} API key in Settings before screening.`, 'error');
    openSettingsBtn.click();
    return;
  }

  const targetList = onlyIds ? candidates.filter(c => onlyIds.includes(c.id)) : candidates;
  const triggerBtn = onlyIds ? screenSelectedBtn : batchScreenBtn;

  batchScreenBtn.disabled = true;
  if (screenSelectedBtn) screenSelectedBtn.disabled = true;
  const originalText = triggerBtn.innerHTML;
  triggerBtn.innerHTML = '<div class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;margin-right:6px;"></div> Screening...';

  for (const cand of targetList) {
    if (evaluations[cand.id]) continue;
    try {
      document.getElementById(`candidate-item-${cand.id}`)?.classList.add('active');
      const content = await ensureResumeContent(cand.id);
      await screenResume(cand.id, cand.name, content);
      renderCandidateList();
    } catch (e) {
      console.error(`Batch screening failed for candidate ${cand.id}`, e);
    }
  }

  batchScreenBtn.disabled = false;
  updateScreenSelectedBtnState();
  if (!onlyIds) triggerBtn.innerHTML = originalText;
  lucide.createIcons();
}

// ------------------------------------------------------------ File upload ---

function slugify(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'candidate';
}

async function handleFileUpload(file) {
  const allowedExtensions = ['.pdf', '.docx', '.png', '.jpg', '.jpeg', '.txt', '.md'];
  const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

  if (!allowedExtensions.includes(extension)) {
    showUploadStatus('Unsupported file format. Please upload PDF, DOCX, PNG, JPG, TXT, or MD.', 'error');
    return;
  }

  const isImageUpload = ['.png', '.jpg', '.jpeg'].includes(extension);
  if (isImageUpload && !apiKeys.mistral) {
    // PDFs have a local text-extraction fallback server-side; images strictly need Mistral OCR.
    showUploadStatus('Image resumes need a Mistral API key for OCR. Add one in Settings.', 'error');
    openSettingsBtn.click();
    return;
  }
  if (!hasKeyForProvider(provider)) {
    showUploadStatus(`Add a ${provider === 'groq' ? 'Groq' : 'Mistral'} API key in Settings before screening.`, 'error');
    openSettingsBtn.click();
    return;
  }

  showUploadStatus('Converting and screening resume...', 'info');

  emptyState.classList.add('hidden');
  dashboardView.classList.add('hidden');
  const spinnerContainer = document.createElement('div');
  spinnerContainer.className = 'loader-container';
  spinnerContainer.id = 'details-loader';
  spinnerContainer.innerHTML = '<div class="spinner"></div>';
  emptyState.parentNode.appendChild(spinnerContainer);

  try {
    const formData = new FormData();
    formData.append('file', file);

    const converted = await apiFetch('/api/convert', {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });

    const candidateId = `custom_${slugify(converted.name)}_${Date.now().toString(36)}`;
    resumeCache[candidateId] = converted.content;

    const customCandidate = { id: candidateId, name: converted.name, file_name: file.name };
    candidates.unshift(customCandidate);
    activeCandidateId = candidateId;
    renderCandidateList();

    const evaluation = await screenResume(candidateId, converted.name, converted.content);

    document.getElementById('details-loader')?.remove();
    renderCandidateList();
    renderEvaluationDashboard(evaluation, converted.content);
    showUploadStatus('Candidate successfully screened and evaluated.', 'success');
  } catch (error) {
    document.getElementById('details-loader')?.remove();
    if (error instanceof ApiKeyRequiredError) {
      showUploadStatus(error.message, 'error');
      openSettingsBtn.click();
    } else {
      showUploadStatus(`Screening failed: ${error.message}`, 'error');
    }
    emptyState.classList.remove('hidden');
  }
}

function showUploadStatus(msg, type) {
  uploadStatus.className = `status-msg ${type}`;
  uploadStatus.innerHTML = `<i data-lucide="${type === 'error' ? 'alert-circle' : (type === 'success' ? 'check-circle' : 'info')}"></i> <span>${msg}</span>`;
  uploadStatus.classList.remove('hidden');
  lucide.createIcons();
  if (type === 'success' || type === 'error') {
    setTimeout(() => uploadStatus.classList.add('hidden'), 6000);
  }
}
