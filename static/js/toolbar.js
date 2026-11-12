/**
 * ToolbarController - Manages toolbar buttons, tools, color palette, keyboard shortcuts, and events.
 */
class ToolbarController {
  constructor(canvasManager, pdfViewer) {
    this.canvasManager = canvasManager;
    this.pdfViewer = pdfViewer;

    this.toolButtons = document.querySelectorAll('.tool-btn[data-tool]');
    this.colorDots = document.querySelectorAll('.color-dot');
    this.customColorPicker = document.getElementById('custom-color-picker');
    this.strokeSlider = document.getElementById('stroke-width-slider');
    this.strokeValueText = document.getElementById('stroke-width-value');

    this.btnUndo = document.getElementById('btn-undo');
    this.btnRedo = document.getElementById('btn-redo');
    this.btnClear = document.getElementById('btn-clear-slide');

    this.btnZoomIn = document.getElementById('btn-zoom-in');
    this.btnZoomOut = document.getElementById('btn-zoom-out');
    this.btnZoomFit = document.getElementById('btn-zoom-fit');
    this.zoomLevelText = document.getElementById('zoom-level-text');

    this.btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    this.sidebar = document.getElementById('sidebar-thumbnails');

    this.init();
  }

  init() {
    this.bindToolButtons();
    this.bindColorPicker();
    this.bindStrokeControls();
    this.bindActionButtons();
    this.bindZoomControls();
    this.bindSidebarToggle();
    this.bindKeyboardShortcuts();

    // Listen to canvas manager state changes to toggle Undo/Redo states
    this.canvasManager.onStateChange = (state) => {
      this.updateHistoryButtons(state.canUndo, state.canRedo);
      this.pdfViewer.updateThumbnailAnnotationBadge(state.currentPage, state.hasAnnotations);
    };
  }

  bindToolButtons() {
    this.toolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool');
        this.selectTool(tool);
      });
    });
  }

  selectTool(tool) {
    this.toolButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tool') === tool);
    });
    this.canvasManager.setTool(tool);
  }

  bindColorPicker() {
    this.colorDots.forEach(dot => {
      dot.addEventListener('click', () => {
        const color = dot.getAttribute('data-color');
        this.selectColor(color);
      });
    });

    if (this.customColorPicker) {
      this.customColorPicker.addEventListener('input', (e) => {
        this.selectColor(e.target.value);
      });
    }
  }

  selectColor(color) {
    this.colorDots.forEach(dot => {
      dot.classList.toggle('active', dot.getAttribute('data-color') === color);
    });
    this.canvasManager.setColor(color);
    if (this.customColorPicker) {
      this.customColorPicker.value = color;
    }
  }

  bindStrokeControls() {
    if (this.strokeSlider) {
      this.strokeSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        if (this.strokeValueText) this.strokeValueText.textContent = `${val}px`;
        this.canvasManager.setStrokeWidth(val);
      });
    }
  }

  bindActionButtons() {
    if (this.btnUndo) {
      this.btnUndo.addEventListener('click', () => this.canvasManager.undo());
    }
    if (this.btnRedo) {
      this.btnRedo.addEventListener('click', () => this.canvasManager.redo());
    }
    if (this.btnClear) {
      this.btnClear.addEventListener('click', () => {
        if (confirm('Hapus semua coretan pada slide aktif ini?')) {
          this.canvasManager.clearSlide();
        }
      });
    }
  }

  updateHistoryButtons(canUndo, canRedo) {
    if (this.btnUndo) this.btnUndo.disabled = !canUndo;
    if (this.btnRedo) this.btnRedo.disabled = !canRedo;
  }

  bindZoomControls() {
    if (this.btnZoomIn) {
      this.btnZoomIn.addEventListener('click', async () => {
        await this.pdfViewer.zoomIn();
        this.updateZoomDisplay();
      });
    }
    if (this.btnZoomOut) {
      this.btnZoomOut.addEventListener('click', async () => {
        await this.pdfViewer.zoomOut();
        this.updateZoomDisplay();
      });
    }
    if (this.btnZoomFit) {
      this.btnZoomFit.addEventListener('click', async () => {
        await this.pdfViewer.zoomFit();
        this.updateZoomDisplay();
      });
    }
  }

  updateZoomDisplay() {
    if (this.zoomLevelText && this.pdfViewer) {
      const pct = Math.round(this.pdfViewer.scale * 100);
      this.zoomLevelText.textContent = `${pct}%`;
    }
  }

  bindSidebarToggle() {
    if (this.btnToggleSidebar && this.sidebar) {
      this.btnToggleSidebar.addEventListener('click', () => {
        this.sidebar.classList.toggle('collapsed');
      });
    }
  }

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ignore if typing inside input, textarea, or contentEditable
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) {
        return;
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          this.canvasManager.redo();
        } else {
          this.canvasManager.undo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        this.canvasManager.redo();
        return;
      }

      // Save project (Ctrl + S)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const btnSave = document.getElementById('btn-save-project');
        if (btnSave) btnSave.click();
        return;
      }

      // Navigation
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        this.pdfViewer.prevPage();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        this.pdfViewer.nextPage();
        return;
      }

      // Tool shortcuts
      const key = e.key.toLowerCase();
      switch (key) {
        case 'p': this.selectTool('pen'); break;
        case 'h': this.selectTool('highlighter'); break;
        case 'e': this.selectTool('eraser'); break;
        case 't': this.selectTool('text'); break;
        case 'l': this.selectTool('line'); break;
        case 'a': this.selectTool('arrow'); break;
        case 'r': this.selectTool('rect'); break;
        case 'b':
          if (this.sidebar) this.sidebar.classList.toggle('collapsed');
          break;
        case '+':
        case '=':
          this.pdfViewer.zoomIn().then(() => this.updateZoomDisplay());
          break;
        case '-':
          this.pdfViewer.zoomOut().then(() => this.updateZoomDisplay());
          break;
        case '?':
          const modalHelp = document.getElementById('modal-help');
          if (modalHelp) modalHelp.classList.remove('hidden');
          break;
      }
    });
  }
}

window.ToolbarController = ToolbarController;

