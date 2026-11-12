/**
 * PDFViewer - PDF.js wrapper for slide presentation rendering, zooming, and thumbnails.
 */
class PDFViewer {
  constructor(pdfCanvas, annotationCanvas, canvasManager) {
    this.pdfCanvas = pdfCanvas;
    this.annotationCanvas = annotationCanvas;
    this.canvasManager = canvasManager;
    this.ctx = pdfCanvas.getContext('2d');

    // PDF.js worker setup
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/static/vendor/pdf.worker.min.js';
    }

    this.pdfDoc = null;
    this.currentPage = 1;
    this.totalPages = 0;
    this.scale = 1.0;
    this.activeRenderTask = null;

    // Callbacks
    this.onPageChange = null;
    this.onDocumentLoaded = null;
  }

  async loadDocument(source) {
    if (this.activeRenderTask) {
      try { this.activeRenderTask.cancel(); } catch (_) {}
    }

    const loadingTask = window.pdfjsLib.getDocument(source);
    this.pdfDoc = await loadingTask.promise;
    this.totalPages = this.pdfDoc.numPages;
    this.currentPage = 1;

    // Auto-fit zoom to current workspace width
    await this.calculateFitWidthScale();
    await this.renderPage(this.currentPage);

    if (this.onDocumentLoaded) {
      this.onDocumentLoaded({
        totalPages: this.totalPages,
        currentPage: this.currentPage
      });
    }

    this.renderThumbnails();
  }

  async calculateFitWidthScale() {
    if (!this.pdfDoc) return;
    try {
      const page = await this.pdfDoc.getPage(1);
      const viewport = page.getViewport({ scale: 1.0 });
      const stage = document.getElementById('slide-stage');
      const stageWidth = stage ? stage.clientWidth - 80 : 900;
      
      let fitScale = stageWidth / viewport.width;
      // Clamp between 0.6 and 1.8
      this.scale = Math.max(0.6, Math.min(1.8, Math.round(fitScale * 10) / 10));
    } catch (e) {
      this.scale = 1.0;
    }
  }

  async getPageDimensions(pageNumber) {
    if (!this.pdfDoc) return { width: 960, height: 540 };
    try {
      const page = await this.pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.0 });
      return { width: viewport.width, height: viewport.height };
    } catch (e) {
      return { width: 960, height: 540 };
    }
  }

  async renderPage(pageNumber) {
    if (!this.pdfDoc) return;
    if (pageNumber < 1 || pageNumber > this.totalPages) return;

    if (this.activeRenderTask) {
      try {
        this.activeRenderTask.cancel();
      } catch (_) {}
    }

    this.currentPage = pageNumber;
    const page = await this.pdfDoc.getPage(pageNumber);

    // Compute viewport with current zoom scale
    const viewport = page.getViewport({ scale: this.scale });
    const outputScale = window.devicePixelRatio || 1;

    // Set PDF Canvas dimensions
    this.pdfCanvas.width = Math.floor(viewport.width * outputScale);
    this.pdfCanvas.height = Math.floor(viewport.height * outputScale);
    this.pdfCanvas.style.width = Math.floor(viewport.width) + 'px';
    this.pdfCanvas.style.height = Math.floor(viewport.height) + 'px';

    // Synchronize Annotation Canvas dimensions precisely
    this.annotationCanvas.width = this.pdfCanvas.width;
    this.annotationCanvas.height = this.pdfCanvas.height;
    this.annotationCanvas.style.width = this.pdfCanvas.style.width;
    this.annotationCanvas.style.height = this.pdfCanvas.style.height;

    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

    const renderContext = {
      canvasContext: this.ctx,
      transform: transform,
      viewport: viewport
    };

    this.activeRenderTask = page.render(renderContext);

    try {
      await this.activeRenderTask.promise;
      this.activeRenderTask = null;
    } catch (err) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('PDF page render error:', err);
      }
    }

    // Switch Canvas Manager to this slide and redraw its annotations
    this.canvasManager.setCurrentPage(pageNumber);

    // Update thumbnail highlights
    this.updateActiveThumbnail(pageNumber);

    if (this.onPageChange) {
      this.onPageChange({
        currentPage: this.currentPage,
        totalPages: this.totalPages,
        scale: this.scale
      });
    }
  }

  async goToPage(pageNumber) {
    const target = parseInt(pageNumber, 10);
    if (isNaN(target) || target < 1 || target > this.totalPages || target === this.currentPage) {
      return;
    }
    await this.renderPage(target);
  }

  async nextPage() {
    if (this.currentPage < this.totalPages) {
      await this.renderPage(this.currentPage + 1);
    }
  }

  async prevPage() {
    if (this.currentPage > 1) {
      await this.renderPage(this.currentPage - 1);
    }
  }

  async zoomIn() {
    if (this.scale >= 2.5) return;
    this.scale = Math.min(2.5, Math.round((this.scale + 0.15) * 100) / 100);
    await this.renderPage(this.currentPage);
  }

  async zoomOut() {
    if (this.scale <= 0.4) return;
    this.scale = Math.max(0.4, Math.round((this.scale - 0.15) * 100) / 100);
    await this.renderPage(this.currentPage);
  }

  async zoomFit() {
    await this.calculateFitWidthScale();
    await this.renderPage(this.currentPage);
  }

  async renderThumbnails() {
    const listEl = document.getElementById('thumbnails-list');
    const countEl = document.getElementById('sidebar-slide-count');
    if (!listEl || !this.pdfDoc) return;

    listEl.innerHTML = '';
    if (countEl) countEl.textContent = `${this.totalPages} Slide`;

    for (let i = 1; i <= this.totalPages; i++) {
      const item = document.createElement('div');
      item.className = `thumbnail-item ${i === this.currentPage ? 'active' : ''}`;
      item.id = `thumb-${i}`;
      item.setAttribute('data-page', i);

      const wrap = document.createElement('div');
      wrap.className = 'thumbnail-canvas-wrap';

      const thumbCanvas = document.createElement('canvas');
      wrap.appendChild(thumbCanvas);

      const footer = document.createElement('div');
      footer.className = 'thumbnail-footer';

      const numSpan = document.createElement('span');
      numSpan.textContent = `Slide ${i}`;

      const badgeDot = document.createElement('span');
      badgeDot.className = 'annotated-badge-dot hidden';
      badgeDot.id = `thumb-badge-${i}`;

      footer.appendChild(numSpan);
      footer.appendChild(badgeDot);

      item.appendChild(wrap);
      item.appendChild(footer);

      item.addEventListener('click', () => {
        this.goToPage(i);
      });

      listEl.appendChild(item);

      // Render thumbnail asynchronously
      this.renderSingleThumbnail(i, thumbCanvas);
    }
  }

  async renderSingleThumbnail(pageNumber, canvas) {
    try {
      const page = await this.pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 0.25 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    } catch (e) {
      console.warn(`Failed to render thumbnail for slide ${pageNumber}:`, e);
    }
  }

  updateActiveThumbnail(pageNumber) {
    document.querySelectorAll('.thumbnail-item').forEach(el => {
      el.classList.toggle('active', parseInt(el.getAttribute('data-page'), 10) === pageNumber);
    });

    const activeThumb = document.getElementById(`thumb-${pageNumber}`);
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  updateThumbnailAnnotationBadge(pageNumber, hasAnnotations) {
    const badge = document.getElementById(`thumb-badge-${pageNumber}`);
    if (badge) {
      badge.classList.toggle('hidden', !hasAnnotations);
    }
  }
}

window.PDFViewer = PDFViewer;

