// Global state
let jobDescription = null;
let candidates = [];
let evaluations = {}; // Cache evaluations by candidate_id
let feedbackCache = {}; // Cache resume-improvement feedback by candidate_id
let activeCandidateId = null;
let selectedIds = new Set(); // Candidate IDs checked for batch "Screen Selected"

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

// Init
document.addEventListener('DOMContentLoaded', () => {
  fetchJobDescription();
  fetchCandidates();
  fetchLlmConfig();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  // Tabs navigation
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active from other buttons and panes
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      
      // Add active to current
      btn.classList.add('active');
      const paneId = btn.getAttribute('data-tab');
      document.getElementById(paneId).classList.add('active');
    });
  });

  // JD Modal triggers
  viewJdBtn.addEventListener('click', () => {
    jdModal.classList.remove('hidden');
    switchJdMode('view');
    renderJobDescriptionModal();
  });
  
  closeJdBtn.addEventListener('click', () => {
    jdModal.classList.add('hidden');
  });
  
  jdModal.addEventListener('click', (e) => {
    if (e.target === jdModal) jdModal.classList.add('hidden');
  });

  // JD Mode tab buttons
  const jdViewTab = document.getElementById('jd-mode-view-btn');
  const jdEditTab = document.getElementById('jd-mode-edit-btn');

  if (jdViewTab && jdEditTab) {
    jdViewTab.addEventListener('click', () => switchJdMode('view'));
    jdEditTab.addEventListener('click', () => switchJdMode('edit'));
  }

  // JD Edit Form submit
  const jdEditForm = document.getElementById('jd-edit-form');
  if (jdEditForm) {
    jdEditForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveJobDescription();
    });
  }

  // JD Reset button
  const resetJdBtn = document.getElementById('reset-jd-btn');
  if (resetJdBtn) {
    resetJdBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to reset to the default Careem Senior Backend Engineer JD?')) {
        await resetJobDescription();
      }
    });
  }

  // Model selector dropdown
  const providerSelect = document.getElementById('llm-provider-select');
  if (providerSelect) {
    providerSelect.addEventListener('change', (e) => {
      updateLlmProvider(e.target.value);
    });
  }

  // Batch screen trigger
  batchScreenBtn.addEventListener('click', () => {
    batchScreenAll();
  });

  if (screenSelectedBtn) {
    screenSelectedBtn.addEventListener('click', () => {
      batchScreenAll(Array.from(selectedIds));
    });
  }

  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      selectedIds = e.target.checked ? new Set(candidates.map(c => c.id)) : new Set();
      renderCandidateList();
    });
  }

  // Resume-improvement feedback (event delegation since the button is replaced dynamically)
  if (feedbackContent) {
    feedbackContent.addEventListener('click', (e) => {
      if (e.target.closest('#generate-feedback-btn')) {
        generateResumeFeedback();
      }
    });
  }

  // Copy resume content
  copyResumeBtn.addEventListener('click', () => {
    const text = resumeRawText.textContent;
    navigator.clipboard.writeText(text).then(() => {
      const originalText = copyResumeBtn.innerHTML;
      copyResumeBtn.innerHTML = '<i data-lucide="check"></i> Copied!';
      lucide.createIcons();
      setTimeout(() => {
        copyResumeBtn.innerHTML = originalText;
        lucide.createIcons();
      }, 2000);
    });
  });

  // Drag and drop setup
  dropzone.addEventListener('click', () => fileInput.click());
  
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });
}

// Fetch Careem JD details
async function fetchJobDescription() {
  try {
    const response = await fetch('/api/jd');
    if (!response.ok) throw new Error('Failed to load Job Description');
    jobDescription = await response.json();
    updateActiveJdPill();
  } catch (error) {
    console.error(error);
  }
}

// Fetch LLM Provider config
async function fetchLlmConfig() {
  try {
    const response = await fetch('/api/llm-config');
    if (response.ok) {
      const data = await response.json();
      const select = document.getElementById('llm-provider-select');
      if (select && data.provider) {
        select.value = data.provider;
      }
    }
  } catch (e) {
    console.error('Failed to fetch LLM config:', e);
  }
}

async function updateLlmProvider(provider) {
  try {
    showUploadStatus(`Switching AI Provider to ${provider.toUpperCase()}...`, 'info');
    const response = await fetch('/api/llm-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider })
    });
    if (!response.ok) throw new Error('Failed to update LLM provider');
    const data = await response.json();
    evaluations = {};
    feedbackCache = {};
    renderCandidateList();
    showUploadStatus(`Successfully switched AI Provider to ${data.provider.toUpperCase()} (${data.model})!`, 'success');
  } catch (err) {
    showUploadStatus(`Provider switch failed: ${err.message}`, 'error');
  }
}

function updateActiveJdPill() {
  const activeJdTitle = document.getElementById('active-jd-title');
  if (activeJdTitle && jobDescription) {
    activeJdTitle.textContent = `${jobDescription.title} (${jobDescription.company})`;
  }
}

// Fetch Candidate resumes list
async function fetchCandidates() {
  try {
    const response = await fetch('/api/candidates');
    if (!response.ok) throw new Error('Failed to load candidates');
    candidates = await response.json();
    renderCandidateList();
  } catch (error) {
    candidatesContainer.innerHTML = `<div class="status-msg error">Error loading candidates: ${error.message}</div>`;
  }
}

// Render candidate items in the sidebar panel
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
    
    // Determine score text or ?
    const scoreVal = isEvaluated ? evaluation.overall_score : '?';
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
      if (e.target.checked) selectedIds.add(cand.id);
      else selectedIds.delete(cand.id);
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

// Select a candidate to screen/display
async function selectCandidate(candidateId) {
  activeCandidateId = candidateId;
  renderCandidateList();

  // Show loading
  emptyState.classList.add('hidden');
  dashboardView.classList.add('hidden');
  
  // Show spinner
  const spinnerContainer = document.createElement('div');
  spinnerContainer.className = 'loader-container';
  spinnerContainer.id = 'details-loader';
  spinnerContainer.innerHTML = '<div class="spinner"></div>';
  emptyState.parentNode.appendChild(spinnerContainer);

  try {
    // 1. Fetch resume raw source content first
    const resumeResponse = await fetch(`/api/candidates/${candidateId}`);
    if (!resumeResponse.ok) throw new Error('Failed to load resume details.');
    const resumeData = await resumeResponse.json();
    
    // 2. Fetch evaluation (from cache or API)
    let evaluation = evaluations[candidateId];
    if (!evaluation) {
      const evalResponse = await fetch(`/api/screen/${candidateId}`, { method: 'POST' });
      if (!evalResponse.ok) throw new Error('Screening analysis failed.');
      evaluation = await evalResponse.json();
      evaluations[candidateId] = evaluation;
      // Re-render list to reflect scores
      renderCandidateList();
    }
    
    // Clean spinner
    const loader = document.getElementById('details-loader');
    if (loader) loader.remove();

    renderEvaluationDashboard(evaluation, resumeData.content);
  } catch (error) {
    const loader = document.getElementById('details-loader');
    if (loader) loader.remove();
    
    emptyState.classList.remove('hidden');
    emptyState.innerHTML = `
      <i data-lucide="alert-circle" class="empty-icon" style="color:var(--status-rejected)"></i>
      <h2>Evaluation Failed</h2>
      <p>${error.message}</p>
      <button class="btn btn-secondary" onclick="selectCandidate('${candidateId}')"><i data-lucide="refresh-cw"></i> Retry</button>
    `;
    lucide.createIcons();
  }
}

// Render overall dashboard evaluation
function renderEvaluationDashboard(evalData, rawResumeContent) {
  dashboardView.classList.remove('hidden');
  emptyState.classList.add('hidden');

  // Candidate basics
  candidateNameTitle.textContent = evalData.candidate_name;
  
  // Initials
  const initials = evalData.candidate_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  candidateInitials.textContent = initials;
  
  // Parsing contact information from resume
  const emailMatch = rawResumeContent.match(/[\w\.-]+@[\w\.-]+\.\w+/);
  const phoneMatch = rawResumeContent.match(/(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4,7}/);
  const locationMatch = rawResumeContent.match(/Location:\s*(.*)/i) || rawResumeContent.match(/Dubai|Saudi Arabia|Singapore|Seattle|San Francisco/i);

  candidateEmail.innerHTML = `<i data-lucide="mail"></i> ${emailMatch ? emailMatch[0] : 'Not specified'}`;
  candidateLocation.innerHTML = `<i data-lucide="map-pin"></i> ${locationMatch ? (Array.isArray(locationMatch) ? locationMatch[0] : locationMatch) : 'Not specified'}`;

  // Circular progress chart
  overallScoreNum.textContent = evalData.overall_score;
  const strokeDash = `${evalData.overall_score}, 100`;
  scoreCirclePath.setAttribute('stroke-dasharray', strokeDash);
  
  // Color the circular chart based on status
  if (evalData.status === 'Shortlisted') {
    scoreCirclePath.style.stroke = 'var(--status-shortlisted)';
  } else if (evalData.status === 'Under Review') {
    scoreCirclePath.style.stroke = 'var(--status-review)';
  } else {
    scoreCirclePath.style.stroke = 'var(--status-rejected)';
  }

  // Status Badge
  statusBadge.className = `status-badge ${evalData.status.replace(' ', '')}`;
  statusBadge.textContent = evalData.status;

  // Breakdown sliders & justifications
  updateDimensionScore('backend', evalData.breakdown.backend_skills);
  updateDimensionScore('design', evalData.breakdown.system_design);
  updateDimensionScore('databases', evalData.breakdown.real_time_databases);
  updateDimensionScore('devops', evalData.breakdown.cloud_devops);
  updateDimensionScore('domain', evalData.breakdown.domain_fit);

  // Summary and date
  evaluationSummary.textContent = evalData.summary;
  evaluationDate.textContent = evalData.evaluation_date || 'Just evaluated';

  // Tailored Questions
  questionsList.innerHTML = '';
  evalData.interview_questions.forEach((q, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="question-number">Question 0${idx + 1}</span>
      <p class="question-text">${q}</p>
    `;
    questionsList.appendChild(li);
  });

  // Raw resume tab content
  resumeRawText.textContent = rawResumeContent;

  // Resume improvement feedback tab: show cached feedback, or reset to the generate button
  const cachedFeedback = feedbackCache[evalData.candidate_id];
  if (cachedFeedback) {
    renderFeedback(cachedFeedback);
  } else {
    feedbackContent.innerHTML = `
      <button id="generate-feedback-btn" class="btn btn-primary">
        <i data-lucide="wand-2"></i> Generate Suggestions
      </button>
    `;
  }

  lucide.createIcons();
}

// Generate (or re-fetch) AI resume-improvement feedback for the active candidate
async function generateResumeFeedback() {
  if (!activeCandidateId) return;

  feedbackContent.innerHTML = `<div class="loader-container"><div class="spinner"></div></div>`;

  try {
    const response = await fetch(`/api/feedback/${activeCandidateId}`, { method: 'POST' });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || 'Feedback generation failed.');
    }
    const feedback = await response.json();
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
      <div class="feedback-section">
        <h4><i data-lucide="thumbs-up"></i> Strengths</h4>
        <ul class="jd-list">${strengths}</ul>
      </div>` : ''}

    ${feedback.improvement_areas && feedback.improvement_areas.length ? `
      <div class="feedback-section">
        <h4><i data-lucide="edit-3"></i> Areas to Improve</h4>
        ${improvements}
      </div>` : ''}

    ${feedback.keyword_gaps && feedback.keyword_gaps.length ? `
      <div class="feedback-section">
        <h4><i data-lucide="tag"></i> Missing Keywords for This Role</h4>
        <div class="keyword-pill-container">${keywordGaps}</div>
      </div>` : ''}

    ${feedback.non_conflicting_notes && feedback.non_conflicting_notes.length ? `
      <div class="feedback-section">
        <h4><i data-lucide="check"></i> Fine As-Is</h4>
        <ul class="jd-list">${nonConflicting}</ul>
      </div>` : ''}

    ${feedback.overall_advice ? `
      <div class="feedback-section overall-advice">
        <h4><i data-lucide="lightbulb"></i> Overall Advice</h4>
        <p>${feedback.overall_advice}</p>
      </div>` : ''}

    <button id="generate-feedback-btn" class="btn btn-secondary btn-sm" style="margin-top:8px;">
      <i data-lucide="refresh-cw"></i> Regenerate
    </button>
  `;
  lucide.createIcons();
}

function updateDimensionScore(key, scoreDim) {
  const scoreElement = document.getElementById(`score-${key}`);
  const fillElement = document.getElementById(`fill-${key}`);
  const justificationElement = document.getElementById(`just-${key}`);

  if (scoreElement && fillElement && justificationElement) {
    scoreElement.textContent = `${scoreDim.score}/5`;
    const percentage = scoreDim.score * 20;
    fillElement.style.width = `${percentage}%`;
    justificationElement.textContent = scoreDim.justification;

    // Apply color gradient to progress bar fills based on scores
    if (scoreDim.score >= 4) {
      fillElement.style.background = 'linear-gradient(90deg, var(--accent-color), var(--status-shortlisted))';
    } else if (scoreDim.score >= 3) {
      fillElement.style.background = 'linear-gradient(90deg, var(--status-review), var(--accent-color))';
    } else {
      fillElement.style.background = 'linear-gradient(90deg, var(--status-rejected), var(--status-review))';
    }
  }
}

// Batch screening -- screens every candidate, or only the given subset of IDs
async function batchScreenAll(onlyIds = null) {
  const targetList = onlyIds ? candidates.filter(c => onlyIds.includes(c.id)) : candidates;
  const triggerBtn = onlyIds ? screenSelectedBtn : batchScreenBtn;

  batchScreenBtn.disabled = true;
  if (screenSelectedBtn) screenSelectedBtn.disabled = true;
  const originalText = triggerBtn.innerHTML;
  triggerBtn.innerHTML = '<div class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;margin-right:6px;"></div> Screening...';
  
  for (let i = 0; i < targetList.length; i++) {
    const cand = targetList[i];
    if (!evaluations[cand.id]) {
      try {
        const itemEl = document.getElementById(`candidate-item-${cand.id}`);
        if (itemEl) itemEl.classList.add('active');
        
        const response = await fetch(`/api/screen/${cand.id}`, { method: 'POST' });
        if (response.ok) {
          evaluations[cand.id] = await response.json();
          renderCandidateList();
        }
      } catch (e) {
        console.error(`Batch screening failed for candidate ${cand.id}`, e);
      }
    }
  }
  
  batchScreenBtn.disabled = false;
  updateScreenSelectedBtnState();
  if (!onlyIds) triggerBtn.innerHTML = originalText;
  lucide.createIcons();
}

// Custom Upload file screening
async function handleFileUpload(file) {
  const allowedExtensions = ['.pdf', '.txt', '.md'];
  const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  
  if (!allowedExtensions.includes(extension)) {
    showUploadStatus('Error: Unsupported file format. Please upload PDF, TXT, or MD.', 'error');
    return;
  }

  showUploadStatus('Uploading & evaluating candidate resume with AI...', 'info');

  const formData = new FormData();
  formData.append('file', file);

  // Show dashboard loader
  emptyState.classList.add('hidden');
  dashboardView.classList.add('hidden');
  const spinnerContainer = document.createElement('div');
  spinnerContainer.className = 'loader-container';
  spinnerContainer.id = 'details-loader';
  spinnerContainer.innerHTML = '<div class="spinner"></div>';
  emptyState.parentNode.appendChild(spinnerContainer);

  try {
    const response = await fetch('/api/screen-custom', {
      method: 'POST',
      body: formData
    });

    const loader = document.getElementById('details-loader');
    if (loader) loader.remove();

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.detail || 'Resume analysis failed.');
    }

    const evaluation = await response.json();
    
    // Add to candidate listings as custom item
    const customCandidate = {
      id: evaluation.candidate_id,
      name: evaluation.candidate_name,
      file_name: file.name,
      file_type: extension.substring(1)
    };

    // Cache the evaluation
    evaluations[customCandidate.id] = evaluation;
    
    // Check if it already exists in candidates, update or append
    const existingIdx = candidates.findIndex(c => c.id === customCandidate.id);
    if (existingIdx !== -1) {
      candidates[existingIdx] = customCandidate;
    } else {
      candidates.unshift(customCandidate); // Append to top
    }

    activeCandidateId = customCandidate.id;
    renderCandidateList();

    // Read file contents locally if it is text/md to show in original tab.
    // If it's PDF, write a placeholder about PDF source.
    let displayContent = `*** Source PDF Document: ${file.name} (Binary Content Processed by AI) ***\n\n`;
    if (extension !== '.pdf') {
      const reader = new FileReader();
      reader.onload = function(e) {
        renderEvaluationDashboard(evaluation, e.target.result);
      };
      reader.readAsText(file);
    } else {
      // For PDFs, we reconstruct structured resume content as extracted
      displayContent += `Successfully extracted and evaluated text via Careem TalentAI parsing engine.\n\n` + 
                         `--- Candidate Profile Summary ---\n\nName: ${evaluation.candidate_name}\nStatus: ${evaluation.status}\n\nSummary:\n${evaluation.summary}`;
      renderEvaluationDashboard(evaluation, displayContent);
    }

    showUploadStatus('Candidate successfully screened and evaluated!', 'success');

  } catch (error) {
    const loader = document.getElementById('details-loader');
    if (loader) loader.remove();

    showUploadStatus(`Screening failed: ${error.message}`, 'error');
    emptyState.classList.remove('hidden');
  }
}

function showUploadStatus(msg, type) {
  uploadStatus.className = `status-msg ${type}`;
  uploadStatus.innerHTML = `<i data-lucide="${type === 'error' ? 'alert-circle' : (type === 'success' ? 'check-circle' : 'info')}"></i> <span>${msg}</span>`;
  uploadStatus.classList.remove('hidden');
  lucide.createIcons();
  
  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      uploadStatus.classList.add('hidden');
    }, 6000);
  }
}

// Render Job Description details in modal
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
      <ul class="jd-list">
        ${jobDescription.requirements.map(req => `<li>${req}</li>`).join('')}
      </ul>
    </div>

    <div class="jd-section">
      <h4>Preferred Qualifications</h4>
      <ul class="jd-list">
        ${jobDescription.preferred_qualifications.map(pref => `<li>${pref}</li>`).join('')}
      </ul>
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

async function saveJobDescription() {
  const saveBtn = document.getElementById('save-jd-btn');
  const originalText = saveBtn.innerHTML;
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<div class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;margin-right:6px;"></div> Saving...';

  const updatedData = {
    title: document.getElementById('jd-title-input').value.trim(),
    company: document.getElementById('jd-company-input').value.trim(),
    department: document.getElementById('jd-dept-input').value.trim(),
    location: document.getElementById('jd-loc-input').value.trim(),
    description: document.getElementById('jd-desc-input').value.trim(),
    requirements: document.getElementById('jd-reqs-input').value.split('\n').map(s => s.trim()).filter(s => s.length > 0),
    preferred_qualifications: document.getElementById('jd-prefs-input').value.split('\n').map(s => s.trim()).filter(s => s.length > 0)
  };

  try {
    const res = await fetch('/api/jd', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
    if (!res.ok) throw new Error('Failed to update Job Description');

    jobDescription = await res.json();
    updateActiveJdPill();

    // Clear evaluations cache since target JD has changed
    evaluations = {};
    feedbackCache = {};
    renderCandidateList();

    switchJdMode('view');
    showUploadStatus('Job Description updated successfully! Candidate cache reset to evaluate against new JD.', 'success');
  } catch (err) {
    showUploadStatus(`Failed to update JD: ${err.message}`, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalText;
    lucide.createIcons();
  }
}

async function resetJobDescription() {
  try {
    const res = await fetch('/api/jd/reset', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reset Job Description');

    jobDescription = await res.json();
    updateActiveJdPill();

    // Clear evaluations cache
    evaluations = {};
    feedbackCache = {};
    renderCandidateList();

    populateJdForm();
    switchJdMode('view');
    showUploadStatus('Job Description reset to Careem default successfully!', 'success');
  } catch (err) {
    showUploadStatus(`Failed to reset JD: ${err.message}`, 'error');
  }
}
