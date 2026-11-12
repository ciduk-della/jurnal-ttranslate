/**
 * Free Corat-Coret PPT - Main Application Controller
 */
document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    projectId: null,
    title: 'Belum ada presentasi terbuka',
    originalFilename: '',
    totalPages: 0,
    currentPage: 1,
    pdfPagesMeta: [],
    isAutosaving: false,
    libreofficeAvailable: false
  };

  // DOM Elements
  const pdfCanvas = document.getElementById('pdf-canvas');
  const annotationCanvas = document.getElementById('annotation-canvas');
  const textOverlay = document.getElementById('text-input-overlay');
  const welcomeScreen = document.getElementById('welcome-screen');
  const viewerContainer = document.getElementById('viewer-container');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingMessage = document.getElementById('loading-message');
  const loadingSubtext = document.getElementById('loading-subtext');
  const presentationTitle = document.getElementById('presentation-title');

  const fileInput = document.getElementById('file-input');
  const dropzone = document.getElementById('dropzone');
  const btnBrowse = document.getElementById('btn-browse-file');
  const btnOpenFile = document.getElementById('btn-open-file');

  const btnPrevSlide = document.getElementById('btn-prev-slide');
  const btnNextSlide = document.getElementById('btn-next-slide');
  const currentPageInput = document.getElementById('current-page-input');
  const totalPagesDisplay = document.getElementById('total-pages-display');

  const btnSaveProject = document.getElementById('btn-save-project');
  const btnOpenProject = document.getElementById('btn-open-project');
  const btnExportPdf = document.getElementById('btn-export-pdf');
  const btnHelp = document.getElementById('btn-help');

  const autosaveText = document.getElementById('autosave-text');

  // Initialize Canvas & PDF Viewer Subsystems
  const canvasManager = new CanvasManager(annotationCanvas, textOverlay);
  const pdfViewer = new PDFViewer(pdfCanvas, annotationCanvas, canvasManager);
  const toolbar = new ToolbarController(canvasManager, pdfViewer);

  // Check LibreOffice system status
  checkSystemStatus();

  // --------------------------------------------------------------------------
  // Document Loaded & Page Change Hooks
  // --------------------------------------------------------------------------
  pdfViewer.onDocumentLoaded = ({ totalPages }) => {
    state.totalPages = totalPages;
    totalPagesDisplay.textContent = totalPages;
    currentPageInput.max = totalPages;
    updatePaginationButtons();
    hideLoading();
  };

  pdfViewer.onPageChange = ({ currentPage, totalPages }) => {
    state.currentPage = currentPage;
    currentPageInput.value = currentPage;
    updatePaginationButtons();
  };

  // Auto-save debouncing
  let autosaveTimer = null;
  canvasManager.onStateChange = (canvasState) => {
    toolbar.updateHistoryButtons(canvasState.canUndo, canvasState.canRedo);
    pdfViewer.updateThumbnailAnnotationBadge(canvasState.currentPage, canvasState.hasAnnotations);

    if (state.projectId) {
      triggerAutosave();
    }
  };

  function triggerAutosave() {
    if (autosaveText) autosaveText.textContent = 'Menyimpan...';
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(async () => {
      try {
        const annotations = canvasManager.getAllAnnotations();
        const projectPayload = {
          project_id: state.projectId,
          title: state.title,
          original_filename: state.originalFilename,
          total_pages: state.totalPages,
          annotations: annotations
        };
        // Save to LocalStorage immediately
        StorageManager.saveLocal(state.projectId, projectPayload);

        // Async save to server
        await StorageManager.saveServer(state.projectId, projectPayload);
        if (autosaveText) autosaveText.textContent = 'Tersimpan';
      } catch (e) {
        if (autosaveText) autosaveText.textContent = 'Gagal menyimpan';
        console.warn('Autosave warning:', e);
      }
    }, 1200);
  }

  // --------------------------------------------------------------------------
  // Pagination Navigation
  // --------------------------------------------------------------------------
  function updatePaginationButtons() {
    btnPrevSlide.disabled = state.currentPage <= 1;
    btnNextSlide.disabled = state.currentPage >= state.totalPages;
  }

  btnPrevSlide.addEventListener('click', () => pdfViewer.prevPage());
  btnNextSlide.addEventListener('click', () => pdfViewer.nextPage());

  currentPageInput.addEventListener('change', (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= state.totalPages) {
      pdfViewer.goToPage(val);
    } else {
      e.target.value = state.currentPage;
    }
  });

  // --------------------------------------------------------------------------
  // File Upload Handling
  // --------------------------------------------------------------------------
  btnBrowse.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  btnOpenFile.addEventListener('click', () => {
    fileInput.click();
  });

  dropzone.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  });

  // Drag and Drop
  ['dragenter', 'dragover'].forEach(eventName => {
    window.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    window.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    }, false);
  });

  window.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      handleFileUpload(dt.files[0]);
    }
  });

  async function handleFileUpload(file) {
    const allowed = ['.pptx', '.ppt', '.pdf'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      showToast('Format file tidak didukung! Gunakan .PPTX, .PPT, atau .PDF', 'error');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      showToast('Ukuran file melebihi batas maksimal 100 MB!', 'error');
      return;
    }

    const isPresentation = ext === '.pptx' || ext === '.ppt';
    showLoading(
      isPresentation ? 'Mengonversi Presentasi PowerPoint...' : 'Membuka Dokumen PDF...',
      isPresentation ? 'Menggunakan LibreOffice engine untuk merender slide' : 'Memuat halaman dan struktur dokumen'
    );

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        hideLoading();
        if (data.code === 'LIBREOFFICE_MISSING') {
          showModal('modal-libreoffice');
        } else {
          showToast(data.message || 'Gagal mengunggah file', 'error', 6000);
        }
        return;
      }

      // Success
      state.projectId = data.project_id;
      state.title = data.title;
      state.originalFilename = data.original_filename;
      state.totalPages = data.total_pages;
      state.pdfPagesMeta = data.pages_meta || [];

      presentationTitle.textContent = state.title;

      // Check if there are cached local annotations for this project
      const localProject = StorageManager.loadLocal(state.projectId);
      if (localProject && localProject.annotations) {
        canvasManager.loadAllAnnotations(localProject.annotations);
      } else if (data.project && data.project.annotations) {
        canvasManager.loadAllAnnotations(data.project.annotations);
      } else {
        canvasManager.loadAllAnnotations({});
      }

      // Show viewer and load PDF
      welcomeScreen.classList.add('hidden');
      viewerContainer.classList.remove('hidden');

      showLoading('Merender Slide Presentasi...', 'Menyiapkan canvas anotasi interaktif');
      await pdfViewer.loadDocument(data.pdf_url);

      showToast(`Berhasil membuka "${file.name}" (${data.total_pages} slide)`, 'success');
      if (autosaveText) autosaveText.textContent = 'Tersimpan';

    } catch (err) {
      hideLoading();
      showToast('Terjadi kesalahan jaringan atau koneksi server: ' + err.message, 'error');
    }
  }

  // --------------------------------------------------------------------------
  // Save Project
  // --------------------------------------------------------------------------
  btnSaveProject.addEventListener('click', async () => {
    if (!state.projectId) {
      showToast('Belum ada presentasi yang dibuka untuk disimpan.', 'info');
      return;
    }

    try {
      const annotations = canvasManager.getAllAnnotations();
      const projectData = {
        project_id: state.projectId,
        title: state.title,
        original_filename: state.originalFilename,
        total_pages: state.totalPages,
        annotations: annotations
      };

      StorageManager.saveLocal(state.projectId, projectData);
      await StorageManager.saveServer(state.projectId, projectData);

      showToast('Proyek dan coretan berhasil disimpan!', 'success');
      if (autosaveText) autosaveText.textContent = 'Tersimpan';
    } catch (e) {
      showToast('Gagal menyimpan proyek: ' + e.message, 'error');
    }
  });

  // --------------------------------------------------------------------------
  // Open / Load Projects Modal
  // --------------------------------------------------------------------------
  btnOpenProject.addEventListener('click', async () => {
    showModal('modal-projects');
    const listEl = document.getElementById('projects-list');
    listEl.innerHTML = '<div class="empty-state">Memuat daftar proyek...</div>';

    try {
      const projects = await StorageManager.listServerProjects();
      if (projects.length === 0) {
        listEl.innerHTML = '<div class="empty-state">Belum ada proyek yang tersimpan sebelumnya.</div>';
        return;
      }

      listEl.innerHTML = '';
      projects.forEach(p => {
        const item = document.createElement('div');
        item.className = 'project-item';
        item.innerHTML = `
          <div>
            <div class="project-title">📄 ${p.title}</div>
            <div class="project-meta">
              File: ${p.original_filename} • ${p.total_pages} slide • ${p.annotated_pages_count} slide beranotasi
            </div>
          </div>
          <button class="btn btn-primary btn-sm btn-load-p">Buka</button>
        `;

        item.querySelector('.btn-load-p').addEventListener('click', () => {
          loadExistingProject(p.project_id);
          hideModal('modal-projects');
        });

        listEl.appendChild(item);
      });
    } catch (e) {
      listEl.innerHTML = `<div class="empty-state text-danger">Gagal memuat: ${e.message}</div>`;
    }
  });

  // Project Import
  const importFileInput = document.getElementById('import-project-file');
  if (importFileInput) {
    importFileInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        try {
          showLoading('Mengimpor Proyek...', 'Membaca manifest data dan goresan anotasi');
          const res = await StorageManager.importProjectFile(e.target.files[0]);
          hideModal('modal-projects');
          await loadExistingProject(res.project_id);
          showToast('Proyek berhasil diimpor!', 'success');
        } catch (err) {
          hideLoading();
          showToast(err.message, 'error');
        }
      }
    });
  }

  async function loadExistingProject(projectId) {
    showLoading('Memuat Proyek...', 'Menyiapkan slide dan mengembalikan coretan');
    try {
      const res = await StorageManager.loadServer(projectId);
      const project = res.project;

      state.projectId = project.project_id;
      state.title = project.title;
      state.originalFilename = project.original_filename;
      state.totalPages = project.total_pages;
      state.pdfPagesMeta = project.pages_meta || [];

      presentationTitle.textContent = state.title;

      canvasManager.loadAllAnnotations(project.annotations || {});

      welcomeScreen.classList.add('hidden');
      viewerContainer.classList.remove('hidden');

      await pdfViewer.loadDocument(`/api/pdf/${projectId}`);
      showToast(`Proyek "${project.title}" berhasil dimuat!`, 'success');
    } catch (e) {
      hideLoading();
      showToast('Gagal memuat proyek: ' + e.message, 'error');
    }
  }

  // --------------------------------------------------------------------------
  // Export PDF with Annotations
  // --------------------------------------------------------------------------
  btnExportPdf.addEventListener('click', () => {
    if (!state.projectId) {
      showToast('Buka file presentasi terlebih dahulu sebelum mengekspor.', 'info');
      return;
    }
    showModal('modal-export');
  });

  const btnConfirmExportPdf = document.getElementById('btn-confirm-export-pdf');
  const btnDownloadProjectJson = document.getElementById('btn-download-project-json');
  const exportProgress = document.getElementById('export-progress');
  const exportStatusMsg = document.getElementById('export-status-message');

  btnConfirmExportPdf.addEventListener('click', async () => {
    btnConfirmExportPdf.disabled = true;
    exportProgress.classList.remove('hidden');
    exportStatusMsg.textContent = 'Merender lapisan anotasi tiap slide...';

    try {
      const overlays = {};
      const allAnnotations = canvasManager.getAllAnnotations();

      // Render overlays for all annotated pages
      for (const [pageNumStr, items] of Object.entries(allAnnotations)) {
        if (items && items.length > 0) {
          const pageNum = parseInt(pageNumStr, 10);
          // Get natural dimensions from pdfViewer or PDF metadata (fallback 1920x1080)
          const dims = await pdfViewer.getPageDimensions(pageNum);
          const renderW = Math.round((dims && dims.width ? dims.width : 960) * 2);
          const renderH = Math.round((dims && dims.height ? dims.height : 540) * 2);

          const dataUrl = canvasManager.renderSlideToDataURL(pageNum, renderW, renderH);
          if (dataUrl) {
            overlays[pageNumStr] = dataUrl;
          }
        }
      }

      exportStatusMsg.textContent = 'Menggabungkan slide asli dengan anotasi di server...';

      const res = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: state.projectId,
          title: state.title,
          overlays: overlays
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal mengekspor PDF');
      }

      exportStatusMsg.textContent = 'Selesai! Mengunduh file PDF...';

      // Trigger file download
      const downloadLink = document.createElement('a');
      downloadLink.href = data.download_url;
      downloadLink.download = data.filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      setTimeout(() => {
        hideModal('modal-export');
        showToast('PDF berhasil diekspor dan diunduh!', 'success');
        btnConfirmExportPdf.disabled = false;
        exportProgress.classList.add('hidden');
      }, 1000);

    } catch (e) {
      exportProgress.classList.add('hidden');
      btnConfirmExportPdf.disabled = false;
      showToast('Error ekspor PDF: ' + e.message, 'error');
    }
  });

  btnDownloadProjectJson.addEventListener('click', () => {
    if (!state.projectId) return;
    window.location.href = `/api/export/project/${state.projectId}`;
    hideModal('modal-export');
    showToast('File proyek sedang diunduh', 'info');
  });

  // --------------------------------------------------------------------------
  // Help Modal
  // --------------------------------------------------------------------------
  btnHelp.addEventListener('click', () => {
    showModal('modal-help');
  });

  // --------------------------------------------------------------------------
  // Modal Utilities
  // --------------------------------------------------------------------------
  function showModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  }

  function hideModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-close');
      hideModal(targetId);
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach(bd => {
    bd.addEventListener('click', () => {
      const modal = bd.closest('.modal');
      if (modal) modal.classList.add('hidden');
    });
  });

  // --------------------------------------------------------------------------
  // Loading & Toast Helpers
  // --------------------------------------------------------------------------
  function showLoading(msg, subtext) {
    loadingMessage.textContent = msg || 'Sedang memproses...';
    loadingSubtext.textContent = subtext || '';
    loadingOverlay.classList.remove('hidden');
  }

  function hideLoading() {
    loadingOverlay.classList.add('hidden');
  }

  function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  async function checkSystemStatus() {
    try {
      const res = await fetch('/api/system-status');
      const data = await res.json();
      state.libreofficeAvailable = data.libreoffice_available;

      const loText = document.getElementById('lo-status-text');
      const banner = document.getElementById('libreoffice-status-banner');
      if (loText && banner) {
        if (data.libreoffice_available) {
          banner.className = 'status-banner success';
          loText.textContent = `LibreOffice terdeteksi (${data.libreoffice_path}). Konversi .pptx/.ppt siap digunakan!`;
        } else {
          banner.className = 'status-banner warning';
          loText.textContent = 'LibreOffice belum terdeteksi. File PDF bekerja langsung 100%. Untuk .pptx/.ppt otomatis, pasang LibreOffice atau ekspor presentasi ke PDF.';
        }
      }
    } catch (_) {}
  }
});

