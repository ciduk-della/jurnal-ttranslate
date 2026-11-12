/**
 * AI Journal & PDF Translator — Client Application Controller
 * Fixes: PDF.js canvas viewer (no iframe black screen), export format alignment,
 *        language conflict prevention, full frontend-backend integration.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ============================================================
  // 1. APPLICATION STATE
  // ============================================================
  const state = {
    documentId: null,
    filename: '',
    totalPages: 0,
    detectedLanguage: 'en',
    translatedSections: [],
    sections: [],
    viewMode: 'mode1',
    activePdfView: 'original',  // 'original' | 'translated'
    hasTranslation: false,
    provider: localStorage.getItem('ccppt_trans_provider') || 'google_free',
    apiKey: localStorage.getItem('ccppt_trans_key') || '',
    terminologyList: []
  };

  // ============================================================
  // 2. PDF.js VIEWER STATE
  // ============================================================
  const pdfViewer = {
    pdfDoc: null,
    currentPage: 1,
    totalPages: 0,
    scale: 1.3,
    rendering: false,
    pendingPage: null,
    workerSrc: '/static/vendor/pdf.worker.min.js'
  };

  // Set up PDF.js worker
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = pdfViewer.workerSrc;
  }

  // ============================================================
  // 3. DOM REFERENCES
  // ============================================================
  const $ = (id) => document.getElementById(id);

  // Upload
  const dropzone           = $('translator-dropzone');
  const fileInput          = $('translator-file-input');
  const btnBrowse          = $('btn-browse-pdf');
  const docInfoCard        = $('doc-info-card');
  const docMetaName        = $('doc-meta-name');
  const docMetaPages       = $('doc-meta-pages');
  const docMetaLang        = $('doc-meta-lang');
  const docMetaOcr         = $('doc-meta-ocr');
  const detectedSectionsList = $('detected-sections-list');
  const btnToggleAllSections = $('btn-toggle-all-sections');

  // Settings controls
  const sourceLangSelect     = $('source-lang-select');
  const targetLangSelect     = $('target-lang-select');
  const chkPreserveEquations = $('chk-preserve-equations');
  const chkPreserveReferences = $('chk-preserve-references');
  const chkPreserveTerminology = $('chk-preserve-terminology');
  const btnStartTranslation  = $('btn-start-translation');

  // Quick text
  const quickInputText  = $('quick-input-text');
  const quickOutputText = $('quick-output-text');
  const btnQuickTranslate = $('btn-quick-translate');

  // View tabs & panels
  const viewTabs       = document.querySelectorAll('.view-tab');
  const emptyStateView = $('empty-state-view');
  const viewMode1      = $('view-mode1');
  const viewMode2      = $('view-mode2');
  const viewMode3      = $('view-mode3');

  // PDF.js viewer elements (Mode 1)
  const pdfjsCanvas         = $('pdfjs-canvas');
  const pdfjsCanvasWrapper  = $('pdfjs-canvas-wrapper');
  const pdfjsViewerContainer = $('pdfjs-viewer-container');
  const pdfjsLoading        = $('pdfjs-loading');
  const pdfjsError          = $('pdfjs-error');
  const pdfjsErrorMsg       = $('pdfjs-error-msg');
  const pdfViewerStatus     = $('pdf-viewer-status');
  const pdfPageInfo         = $('pdf-page-info');
  const pdfZoomLabel        = $('pdf-zoom-label');
  const btnViewTranslatedPdf = $('btn-view-translated-pdf');
  const btnViewOriginalPdf   = $('btn-view-original-pdf');
  const btnPdfPrev           = $('btn-pdf-prev');
  const btnPdfNext           = $('btn-pdf-next');
  const btnPdfZoomIn         = $('btn-pdf-zoom-in');
  const btnPdfZoomOut        = $('btn-pdf-zoom-out');

  // Progress
  const progressBarContainer = $('translation-progress-bar-container');
  const progressStatusText   = $('progress-status-text');
  const progressPercentage   = $('progress-percentage');
  const progressFill         = $('progress-fill');

  // Export buttons
  const btnExportPdf      = $('btn-export-pdf');
  const btnExportBilingual = $('btn-export-bilingual');
  const btnExportCleanPdf  = $('btn-export-clean-pdf');
  const btnExportDocx     = $('btn-export-docx');
  const btnExportTxt      = $('btn-export-txt');

  // Modal triggers
  const btnOpenDictionary = $('btn-open-dictionary');
  const btnOpenSettings   = $('btn-open-settings');

  // Terminology modal
  const termSearchInput   = $('term-search-input');
  const addTermEn         = $('add-term-en');
  const addTermId         = $('add-term-id');
  const btnAddTerm        = $('btn-add-term');
  const termTableBody     = $('term-table-body');

  // Settings modal
  const settingProviderSelect = $('setting-provider-select');
  const settingDeeplKey   = $('setting-deepl-key');
  const deeplKeyGroup     = $('deepl-key-group');
  const btnSaveSettings   = $('btn-save-settings');

  // ============================================================
  // 4. INITIALISE SETTINGS
  // ============================================================
  if (settingProviderSelect) settingProviderSelect.value = state.provider;
  if (settingDeeplKey) settingDeeplKey.value = state.apiKey;
  if (deeplKeyGroup) deeplKeyGroup.classList.toggle('hidden', state.provider !== 'deepl');

  // ============================================================
  // 5. PDF.js CANVAS VIEWER
  // ============================================================
  async function loadPdfInViewer(url) {
    if (!window.pdfjsLib) {
      showPdfError('PDF.js tidak tersedia. Reload halaman ini.');
      return;
    }

    showPdfLoading(true);
    hidePdfError();
    if (pdfViewerStatus) pdfViewerStatus.textContent = '📂 Memuat PDF...';

    try {
      if (pdfViewer.pdfDoc) {
        pdfViewer.pdfDoc.destroy();
        pdfViewer.pdfDoc = null;
      }

      const loadingTask = window.pdfjsLib.getDocument({ url, withCredentials: false });
      pdfViewer.pdfDoc = await loadingTask.promise;
      pdfViewer.totalPages = pdfViewer.pdfDoc.numPages;
      pdfViewer.currentPage = 1;
      pdfViewer.rendering = false;
      pdfViewer.pendingPage = null;

      await renderPdfPage(pdfViewer.currentPage);
      updatePdfNav();
      showPdfLoading(false);

      const label = state.activePdfView === 'translated' ? '✅ PDF Terjemahan dimuat' : '📄 PDF Asli dimuat';
      if (pdfViewerStatus) pdfViewerStatus.textContent = label;

    } catch (err) {
      showPdfLoading(false);
      const errMsg = String(err && (err.message || err));
      if (errMsg.includes('404')) {
        showPdfError('PDF terjemahan belum selesai dibuat. Silakan klik tombol "Terjemahkan Dokumen Jurnal" di panel sebelah kiri.');
        if (pdfViewerStatus) pdfViewerStatus.textContent = '⚠️ Belum Ada Terjemahan';
      } else {
        showPdfError(`Gagal memuat PDF: ${errMsg}`);
        if (pdfViewerStatus) pdfViewerStatus.textContent = '⚠️ Gagal Memuat';
      }
      console.error('[PDFViewer] Load error:', err);
    }
  }

  async function renderPdfPage(pageNum) {
    if (!pdfViewer.pdfDoc) return;
    if (pageNum < 1 || pageNum > pdfViewer.totalPages) return;

    if (pdfViewer.rendering) {
      pdfViewer.pendingPage = pageNum;
      return;
    }

    pdfViewer.rendering = true;
    pdfViewer.currentPage = pageNum;

    try {
      const page = await pdfViewer.pdfDoc.getPage(pageNum);
      const deviceRatio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: pdfViewer.scale * deviceRatio });

      pdfjsCanvas.width = viewport.width;
      pdfjsCanvas.height = viewport.height;
      pdfjsCanvas.style.width = Math.floor(viewport.width / deviceRatio) + 'px';
      pdfjsCanvas.style.height = Math.floor(viewport.height / deviceRatio) + 'px';

      const ctx = pdfjsCanvas.getContext('2d');
      ctx.clearRect(0, 0, pdfjsCanvas.width, pdfjsCanvas.height);

      const renderContext = {
        canvasContext: ctx,
        viewport,
        annotationMode: 0,
        renderInteractiveForms: false
      };
      await page.render(renderContext).promise;
      updatePdfNav();
    } catch (err) {
      if (err && err.name !== 'RenderingCancelledException') {
        console.error('[PDFViewer] Render error page', pageNum, err);
      }
    } finally {
      pdfViewer.rendering = false;
      if (pdfViewer.pendingPage !== null) {
        const next = pdfViewer.pendingPage;
        pdfViewer.pendingPage = null;
        await renderPdfPage(next);
      }
    }
  }

  function updatePdfNav() {
    if (pdfPageInfo) {
      pdfPageInfo.textContent = `Hal. ${pdfViewer.currentPage} / ${pdfViewer.totalPages}`;
    }
    if (pdfZoomLabel) {
      pdfZoomLabel.textContent = Math.round(pdfViewer.scale * 100) + '%';
    }
    if (btnPdfPrev) btnPdfPrev.disabled = pdfViewer.currentPage <= 1;
    if (btnPdfNext) btnPdfNext.disabled = pdfViewer.currentPage >= pdfViewer.totalPages;
  }

  function showPdfLoading(show) {
    if (pdfjsLoading) pdfjsLoading.classList.toggle('hidden', !show);
    if (pdfjsCanvasWrapper) pdfjsCanvasWrapper.style.opacity = show ? '0.3' : '1';
  }

  function showPdfError(msg) {
    if (pdfjsError) pdfjsError.classList.remove('hidden');
    if (pdfjsErrorMsg) pdfjsErrorMsg.textContent = msg;
  }

  function hidePdfError() {
    if (pdfjsError) pdfjsError.classList.add('hidden');
  }

  function getCurrentPdfUrl() {
    if (!state.documentId) return null;
    if (state.activePdfView === 'translated' && state.hasTranslation) {
      return `/api/translator/translated_pdf/${state.documentId}?t=${Date.now()}`;
    }
    return `/api/translator/pdf/${state.documentId}?t=${Date.now()}`;
  }

  async function switchPdfViewAndLoad(view) {
    state.activePdfView = view;

    if (btnViewTranslatedPdf) btnViewTranslatedPdf.classList.toggle('active', view === 'translated');
    if (btnViewOriginalPdf)   btnViewOriginalPdf.classList.toggle('active', view === 'original');

    // If translated selected but no translation yet, warn
    if (view === 'translated' && !state.hasTranslation) {
      showToast('Terjemahan belum tersedia. Jalankan penerjemahan terlebih dahulu.', 'info');
      return;
    }

    const url = getCurrentPdfUrl();
    if (url) await loadPdfInViewer(url);
  }

  // PDF Navigation events
  if (btnPdfPrev) {
    btnPdfPrev.addEventListener('click', () => {
      if (pdfViewer.currentPage > 1) renderPdfPage(pdfViewer.currentPage - 1);
    });
  }
  if (btnPdfNext) {
    btnPdfNext.addEventListener('click', () => {
      if (pdfViewer.currentPage < pdfViewer.totalPages) renderPdfPage(pdfViewer.currentPage + 1);
    });
  }
  if (btnPdfZoomIn) {
    btnPdfZoomIn.addEventListener('click', () => {
      pdfViewer.scale = Math.min(3.0, pdfViewer.scale + 0.2);
      renderPdfPage(pdfViewer.currentPage);
      if (pdfZoomLabel) pdfZoomLabel.textContent = Math.round(pdfViewer.scale * 100) + '%';
    });
  }
  if (btnPdfZoomOut) {
    btnPdfZoomOut.addEventListener('click', () => {
      pdfViewer.scale = Math.max(0.5, pdfViewer.scale - 0.2);
      renderPdfPage(pdfViewer.currentPage);
      if (pdfZoomLabel) pdfZoomLabel.textContent = Math.round(pdfViewer.scale * 100) + '%';
    });
  }
  if (btnViewOriginalPdf) {
    btnViewOriginalPdf.addEventListener('click', () => switchPdfViewAndLoad('original'));
  }
  if (btnViewTranslatedPdf) {
    btnViewTranslatedPdf.addEventListener('click', () => switchPdfViewAndLoad('translated'));
  }

  // ============================================================
  // 6. LANGUAGE CONFLICT PREVENTION
  // ============================================================
  function fixLanguageConflict() {
    const src = sourceLangSelect ? sourceLangSelect.value : 'auto';
    const tgt = targetLangSelect ? targetLangSelect.value : 'id';
    if (src !== 'auto' && src === tgt) {
      if (targetLangSelect) targetLangSelect.value = src === 'id' ? 'en' : 'id';
    }
  }

  if (sourceLangSelect) sourceLangSelect.addEventListener('change', fixLanguageConflict);
  if (targetLangSelect) targetLangSelect.addEventListener('change', fixLanguageConflict);

  // ============================================================
  // 7. FILE UPLOAD
  // ============================================================
  if (btnBrowse) {
    btnBrowse.addEventListener('click', (e) => { e.stopPropagation(); fileInput && fileInput.click(); });
  }
  if (dropzone) {
    dropzone.addEventListener('click', () => fileInput && fileInput.click());
    ['dragenter', 'dragover'].forEach(evt => {
      dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(evt => {
      dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); });
    });
    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) handleFileUpload(files[0]);
    });
  }
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) handleFileUpload(e.target.files[0]);
    });
  }

  async function handleFileUpload(file) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Hanya file PDF yang didukung.', 'error');
      return;
    }

    showProgress(10, 'Mengunggah dan menganalisis struktur PDF...');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/translator/upload', { method: 'POST', body: formData });
      const data = await res.json();
      hideProgress();

      if (!res.ok) {
        showToast(data.message || 'Gagal memproses PDF.', 'error');
        return;
      }

      const doc = data.data;
      state.documentId        = doc.doc_id;
      state.filename          = doc.filename;
      state.totalPages        = doc.total_pages;
      state.detectedLanguage  = doc.detected_language;
      state.sections          = doc.sections || [];
      state.translatedSections = [];
      state.hasTranslation    = false;

      // Update sidebar info
      if (docMetaName)  docMetaName.textContent  = doc.filename;
      if (docMetaPages) docMetaPages.textContent = `${doc.total_pages} Halaman`;
      if (docMetaLang)  docMetaLang.textContent  = `${doc.detected_language_name} (${doc.detected_language})`;
      if (docMetaOcr) {
        if (doc.is_scanned) {
          docMetaOcr.textContent  = 'Hasil Scan (OCR)';
          docMetaOcr.className    = 'meta-val text-warning';
        } else {
          docMetaOcr.textContent  = 'Teks Digital (Siap)';
          docMetaOcr.className    = 'meta-val text-success';
        }
      }

      // Smart language pre-selection
      if (sourceLangSelect && targetLangSelect) {
        if (doc.detected_language === 'id') {
          sourceLangSelect.value = 'id';
          targetLangSelect.value = 'en';
        } else if (['en', 'de', 'ja', 'zh-cn'].includes(doc.detected_language)) {
          sourceLangSelect.value = doc.detected_language;
          targetLangSelect.value = 'id';
        } else {
          sourceLangSelect.value = 'auto';
          targetLangSelect.value = 'id';
        }
      }

      renderSectionsChecklist(state.sections);
      if (docInfoCard) docInfoCard.classList.remove('hidden');
      if (btnStartTranslation) btnStartTranslation.disabled = false;
      disableExportButtons();

      // Show Mode 1 immediately with original PDF preview
      state.activePdfView = 'original';
      state.viewMode = 'mode1';
      emptyStateView && emptyStateView.classList.add('hidden');
      viewMode1 && viewMode1.classList.remove('hidden');
      viewMode2 && viewMode2.classList.add('hidden');
      viewMode3 && viewMode3.classList.add('hidden');
      if (btnViewOriginalPdf)   btnViewOriginalPdf.classList.add('active');
      if (btnViewTranslatedPdf) btnViewTranslatedPdf.classList.remove('active');
      viewTabs.forEach(t => t.classList.toggle('active', t.dataset.mode === 'mode1'));

      // Load original PDF into viewer
      await loadPdfInViewer(`/api/translator/pdf/${state.documentId}?t=${Date.now()}`);

      showToast(`"${doc.filename}" berhasil dianalisis (${state.sections.length} bagian)`, 'success');
    } catch (err) {
      hideProgress();
      showToast('Kesalahan jaringan: ' + err.message, 'error');
    }
  }

  function renderSectionsChecklist(sections) {
    if (!detectedSectionsList) return;
    detectedSectionsList.innerHTML = '';
    sections.forEach((sec, idx) => {
      const label = document.createElement('label');
      label.className = 'section-item-label';
      label.innerHTML = `
        <input type="checkbox" class="sec-chk" data-idx="${idx}" checked>
        <span>${escapeHtml(sec.name)} <small class="text-muted">(hal. ${sec.start_page})</small></span>
      `;
      detectedSectionsList.appendChild(label);
    });
  }

  if (btnToggleAllSections) {
    btnToggleAllSections.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('.sec-chk');
      const allChecked = Array.from(checkboxes).every(c => c.checked);
      checkboxes.forEach(c => c.checked = !allChecked);
      btnToggleAllSections.textContent = allChecked ? 'Pilih Semua' : 'Batal Pilih';
    });
  }

  // ============================================================
  // 8. DOCUMENT TRANSLATION
  // ============================================================
  if (btnStartTranslation) {
    btnStartTranslation.addEventListener('click', async () => {
      if (!state.documentId) return;

      const checkedBoxes = document.querySelectorAll('.sec-chk:checked');
      const selectedIndices = Array.from(checkedBoxes).map(c => parseInt(c.dataset.idx, 10));
      if (selectedIndices.length === 0) {
        showToast('Pilih setidaknya satu bagian untuk diterjemahkan.', 'info');
        return;
      }

      btnStartTranslation.disabled = true;
      showProgress(15, 'Memulai penerjemahan akademik...');

      const payload = {
        doc_id:              state.documentId,
        source_lang:         sourceLangSelect ? sourceLangSelect.value : 'auto',
        target_lang:         targetLangSelect ? targetLangSelect.value : 'id',
        provider:            state.provider,
        api_key:             state.apiKey,
        preserve_equations:  chkPreserveEquations  ? chkPreserveEquations.checked  : true,
        preserve_references: chkPreserveReferences ? chkPreserveReferences.checked : true,
        preserve_terminology:chkPreserveTerminology? chkPreserveTerminology.checked : true,
        selected_sections:   selectedIndices
      };

      const statusMsgs = [
        'Mempertahankan posisi gambar dan tabel...',
        'Menerapkan kamus Teknik Sipil baku...',
        'Menyusun kalimat akademik bahasa Indonesia...',
        'Rekonstruksi koordinat layout PDF...'
      ];
      let msgIdx = 0;
      const statusTimer = setInterval(() => {
        msgIdx = (msgIdx + 1) % statusMsgs.length;
        if (progressStatusText) progressStatusText.textContent = statusMsgs[msgIdx];
      }, 2500);

      try {
        const res = await fetch('/api/translator/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        clearInterval(statusTimer);
        const data = await res.json();

        if (!res.ok) {
          hideProgress();
          btnStartTranslation.disabled = false;
          showToast(data.message || 'Gagal menerjemahkan.', 'error', 6000);
          return;
        }

        showProgress(100, 'Penerjemahan selesai!');
        setTimeout(hideProgress, 1000);

        state.translatedSections = data.data.translated_sections || [];
        state.hasTranslation     = true;
        btnStartTranslation.disabled = false;

        // Render all views
        renderAllViews(state.translatedSections);
        enableExportButtons();
        switchViewMode('mode1');

        // Auto-load the translated PDF into the viewer
        state.activePdfView = 'translated';
        if (btnViewTranslatedPdf) btnViewTranslatedPdf.classList.add('active');
        if (btnViewOriginalPdf)   btnViewOriginalPdf.classList.remove('active');
        await loadPdfInViewer(`/api/translator/translated_pdf/${state.documentId}?t=${Date.now()}`);

        showToast('Penerjemahan selesai! Layout, gambar, dan tabel tetap utuh.', 'success');
      } catch (err) {
        clearInterval(statusTimer);
        hideProgress();
        btnStartTranslation.disabled = false;
        showToast('Error: ' + err.message, 'error');
      }
    });
  }

  // ============================================================
  // 9. RENDER RESULTS
  // ============================================================
  function renderAllViews(sections) {
    // Mode 2 — Clean Text
    if (viewMode2) {
      viewMode2.innerHTML = '';
      sections.forEach(sec => {
        const title = document.createElement('h3');
        title.className = 'trans-section-title';
        title.textContent = sec.translated_name || sec.original_name;
        viewMode2.appendChild(title);

        const rawText = sec.translated_text || '';
        rawText.split('\n\n').forEach(p => {
          const trimmed = p.trim();
          if (trimmed) {
            const pEl = document.createElement('p');
            pEl.className = 'trans-body-p';
            pEl.textContent = trimmed;
            viewMode2.appendChild(pEl);
          }
        });
      });
    }

    // Mode 3 — Bilingual Comparison
    if (viewMode3) {
      viewMode3.innerHTML = '';
      sections.forEach(sec => {
        const card = document.createElement('div');
        card.className = 'comparison-card';
        card.innerHTML = `
          <div class="comparison-card-header">
            <span class="header-orig">${escapeHtml(sec.original_name)}</span>
            <span class="header-trans">${escapeHtml(sec.translated_name || sec.original_name)}</span>
          </div>
          <div class="comparison-grid">
            <div class="col-original">${escapeHtml(sec.original_text || '')}</div>
            <div class="col-translated">${escapeHtml(sec.translated_text || '')}</div>
          </div>
        `;
        viewMode3.appendChild(card);
      });
    }
  }

  // ============================================================
  // 10. VIEW MODE TABS
  // ============================================================
  viewTabs.forEach(tab => {
    tab.addEventListener('click', () => switchViewMode(tab.dataset.mode));
  });

  function switchViewMode(mode) {
    state.viewMode = mode;
    viewTabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));

    const hasContent = state.translatedSections.length > 0 || state.documentId;
    emptyStateView && emptyStateView.classList.toggle('hidden', !!state.documentId);
    viewMode1 && viewMode1.classList.toggle('hidden', mode !== 'mode1');
    viewMode2 && viewMode2.classList.toggle('hidden', mode !== 'mode2');
    viewMode3 && viewMode3.classList.toggle('hidden', mode !== 'mode3');

    // If switching to Mode 2 or 3 but no translation yet
    if ((mode === 'mode2' || mode === 'mode3') && state.translatedSections.length === 0) {
      showToast('Jalankan penerjemahan terlebih dahulu untuk melihat mode ini.', 'info');
    }
  }

  // ============================================================
  // 11. EXPORT BUTTONS  (format names consistent with backend)
  // ============================================================
  if (btnExportPdf) {
    btnExportPdf.addEventListener('click', () => triggerExport('layout_pdf'));
  }
  if (btnExportCleanPdf) {
    btnExportCleanPdf.addEventListener('click', () => triggerExport('translated_pdf'));
  }
  if (btnExportBilingual) {
    btnExportBilingual.addEventListener('click', () => triggerExport('bilingual_pdf'));
  }
  if (btnExportDocx) {
    btnExportDocx.addEventListener('click', () => triggerExport('docx'));
  }
  if (btnExportTxt) {
    btnExportTxt.addEventListener('click', () => triggerExport('txt'));
  }

  async function triggerExport(format) {
    if (!state.documentId) return;
    showToast('Menyiapkan file ekspor...', 'info');

    // Use fetch to get proper error messages instead of silent redirect failures
    try {
      const res = await fetch(`/api/translator/export/${state.documentId}/${format}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || `Gagal mengekspor format ${format}.`, 'error', 5000);
        return;
      }
      // Trigger browser download from blob
      const blob = await res.blob();
      const contentDisposition = res.headers.get('Content-Disposition') || '';
      const filenameParts = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      const filename = filenameParts ? filenameParts[1].replace(/['"]/g, '') : `export.${format.split('_')[0]}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
      showToast('File berhasil diunduh!', 'success');
    } catch (err) {
      showToast('Gagal mengunduh: ' + err.message, 'error');
    }
  }

  function enableExportButtons() {
    [btnExportPdf, btnExportCleanPdf, btnExportBilingual, btnExportDocx, btnExportTxt].forEach(b => {
      if (b) b.disabled = false;
    });
  }

  function disableExportButtons() {
    [btnExportPdf, btnExportCleanPdf, btnExportBilingual, btnExportDocx, btnExportTxt].forEach(b => {
      if (b) b.disabled = true;
    });
  }

  // ============================================================
  // 12. QUICK TEXT TRANSLATION
  // ============================================================
  if (btnQuickTranslate) {
    btnQuickTranslate.addEventListener('click', async () => {
      const text = quickInputText ? quickInputText.value.trim() : '';
      if (!text) { showToast('Masukkan teks terlebih dahulu.', 'info'); return; }

      btnQuickTranslate.disabled = true;
      btnQuickTranslate.textContent = 'Menerjemahkan...';

      try {
        const res = await fetch('/api/translator/translate/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            source_lang: sourceLangSelect ? sourceLangSelect.value : 'auto',
            target_lang: targetLangSelect ? targetLangSelect.value : 'id',
            provider: state.provider,
            api_key: state.apiKey
          })
        });
        const data = await res.json();
        if (res.ok && quickOutputText) {
          quickOutputText.textContent = data.translated_text;
          quickOutputText.classList.remove('hidden');
        } else {
          showToast(data.message || 'Gagal menerjemahkan.', 'error');
        }
      } catch (e) {
        showToast('Error: ' + e.message, 'error');
      } finally {
        btnQuickTranslate.disabled = false;
        btnQuickTranslate.textContent = 'Terjemahkan Teks';
      }
    });
  }

  // ============================================================
  // 13. TERMINOLOGY DICTIONARY MODAL
  // ============================================================
  if (btnOpenDictionary) {
    btnOpenDictionary.addEventListener('click', () => { showModal('modal-terminology'); loadTerminology(); });
  }

  async function loadTerminology() {
    if (!termTableBody) return;
    termTableBody.innerHTML = '<tr><td colspan="3" class="text-center">Memuat...</td></tr>';
    try {
      const res = await fetch('/api/translator/terminology');
      const data = await res.json();
      state.terminologyList = data.terms || [];
      renderTerminologyTable(state.terminologyList);
    } catch (e) {
      termTableBody.innerHTML = `<tr><td colspan="3" class="text-danger text-center">Gagal: ${e.message}</td></tr>`;
    }
  }

  function renderTerminologyTable(terms) {
    if (!termTableBody) return;
    termTableBody.innerHTML = '';
    if (!terms.length) {
      termTableBody.innerHTML = '<tr><td colspan="3" class="text-center">Tidak ada istilah.</td></tr>';
      return;
    }
    terms.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(item.english)}</strong></td>
        <td><span class="text-success">${escapeHtml(item.indonesian)}</span></td>
        <td>${item.is_custom
          ? `<button class="btn-del-term" data-term="${escapeHtml(item.english)}">🗑️</button>`
          : '<span class="text-muted">Baku</span>'}</td>
      `;
      tr.querySelector('.btn-del-term')?.addEventListener('click', () => deleteCustomTerm(item.english));
      termTableBody.appendChild(tr);
    });
  }

  if (termSearchInput) {
    termSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      renderTerminologyTable(state.terminologyList.filter(t =>
        t.english.toLowerCase().includes(q) || t.indonesian.toLowerCase().includes(q)
      ));
    });
  }

  if (btnAddTerm) {
    btnAddTerm.addEventListener('click', async () => {
      const en = addTermEn ? addTermEn.value.trim() : '';
      const id = addTermId ? addTermId.value.trim() : '';
      if (!en || !id) { showToast('Isi kedua kolom istilah.', 'info'); return; }
      try {
        const res = await fetch('/api/translator/terminology', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ english: en, indonesian: id })
        });
        const data = await res.json();
        if (res.ok) {
          if (addTermEn) addTermEn.value = '';
          if (addTermId) addTermId.value = '';
          showToast(data.message, 'success');
          loadTerminology();
        } else {
          showToast(data.message || 'Gagal menambah istilah.', 'error');
        }
      } catch (e) { showToast(e.message, 'error'); }
    });
  }

  async function deleteCustomTerm(enTerm) {
    if (!confirm(`Hapus "${enTerm}"?`)) return;
    try {
      const res = await fetch(`/api/translator/terminology/${encodeURIComponent(enTerm)}`, { method: 'DELETE' });
      if (res.ok) { showToast('Istilah dihapus.', 'success'); loadTerminology(); }
    } catch (e) { showToast(e.message, 'error'); }
  }

  // ============================================================
  // 14. SETTINGS MODAL
  // ============================================================
  if (btnOpenSettings) {
    btnOpenSettings.addEventListener('click', () => {
      if (settingProviderSelect) settingProviderSelect.value = state.provider;
      if (settingDeeplKey) settingDeeplKey.value = state.apiKey;
      if (deeplKeyGroup) deeplKeyGroup.classList.toggle('hidden', state.provider !== 'deepl');
      showModal('modal-settings');
    });
  }
  if (settingProviderSelect) {
    settingProviderSelect.addEventListener('change', (e) => {
      if (deeplKeyGroup) deeplKeyGroup.classList.toggle('hidden', e.target.value !== 'deepl');
    });
  }
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', () => {
      state.provider = settingProviderSelect ? settingProviderSelect.value : 'google_free';
      state.apiKey   = settingDeeplKey ? settingDeeplKey.value.trim() : '';
      localStorage.setItem('ccppt_trans_provider', state.provider);
      localStorage.setItem('ccppt_trans_key', state.apiKey);
      hideModal('modal-settings');
      showToast('Pengaturan disimpan!', 'success');
    });
  }

  // ============================================================
  // 15. UTILITIES
  // ============================================================
  function showModal(id) { const el = $(id); if (el) el.classList.remove('hidden'); }
  function hideModal(id) { const el = $(id); if (el) el.classList.add('hidden'); }

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => hideModal(btn.getAttribute('data-close')));
  });
  document.querySelectorAll('.modal-backdrop').forEach(bd => {
    bd.addEventListener('click', () => { const m = bd.closest('.modal'); if (m) m.classList.add('hidden'); });
  });

  function showProgress(pct, text) {
    if (progressBarContainer) progressBarContainer.classList.remove('hidden');
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressPercentage) progressPercentage.textContent = `${pct}%`;
    if (text && progressStatusText) progressStatusText.textContent = text;
  }

  function hideProgress() {
    if (progressBarContainer) progressBarContainer.classList.add('hidden');
  }

  function showToast(message, type = 'info', duration = 3500) {
    const container = $('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(String(message))}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.cssText += 'opacity:0;transform:translateX(100%);transition:all 0.3s ease';
      setTimeout(() => toast.remove(), 310);
    }, duration);
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
