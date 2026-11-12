/**
 * CanvasManager - Interactive HTML5 Canvas Annotation Layer
 * Handles drawing, normalized coordinates, zoom resilience, undo/redo, and rendering.
 */
class CanvasManager {
  constructor(canvasElement, textOverlayElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.textOverlay = textOverlayElement;
    this.textArea = document.getElementById('annotation-text-input');

    // Tool configuration
    this.currentTool = 'pen'; // 'pen' | 'highlighter' | 'eraser' | 'text' | 'line' | 'arrow' | 'rect'
    this.currentColor = '#e02424';
    this.currentStrokeWidth = 4;
    this.currentPage = 1;

    // Per-page annotation data: { [pageNumber]: Array<AnnotationObject> }
    this.pagesData = {};
    
    // Per-page history stacks
    this.undoStacks = {};
    this.redoStacks = {};

    // Live interaction state
    this.isDrawing = false;
    this.activeStroke = null;
    this.startPoint = null;
    this.pendingTextCoord = null;

    // Callbacks
    this.onStateChange = null;

    this.initEvents();
  }

  initEvents() {
    // Pointer Events for unified Mouse, Touch, and Stylus support
    this.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.handlePointerUp(e));
    this.canvas.addEventListener('pointercancel', (e) => this.handlePointerUp(e));

    // Text Overlay actions
    const btnSubmit = document.getElementById('btn-text-submit');
    const btnCancel = document.getElementById('btn-text-cancel');

    if (btnSubmit) {
      btnSubmit.addEventListener('click', () => this.commitTextAnnotation());
    }
    if (btnCancel) {
      btnCancel.addEventListener('click', () => this.cancelTextAnnotation());
    }
    if (this.textArea) {
      this.textArea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.commitTextAnnotation();
        } else if (e.key === 'Escape') {
          this.cancelTextAnnotation();
        }
      });
    }
  }

  setTool(tool) {
    this.currentTool = tool;
    this.updateCursor();
  }

  setColor(color) {
    this.currentColor = color;
  }

  setStrokeWidth(width) {
    this.currentStrokeWidth = parseInt(width, 10) || 4;
  }

  updateCursor() {
    if (this.currentTool === 'eraser') {
      this.canvas.style.cursor = 'cell';
    } else if (this.currentTool === 'text') {
      this.canvas.style.cursor = 'text';
    } else {
      this.canvas.style.cursor = 'crosshair';
    }
  }

  setCurrentPage(pageNum) {
    this.currentPage = pageNum;
    if (!this.pagesData[pageNum]) {
      this.pagesData[pageNum] = [];
    }
    if (!this.undoStacks[pageNum]) {
      this.undoStacks[pageNum] = [];
    }
    if (!this.redoStacks[pageNum]) {
      this.redoStacks[pageNum] = [];
    }
    this.cancelTextAnnotation();
    this.redrawCurrentPage();
    this.notifyStateChange();
  }

  getCanvasPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const rawY = (e.clientY - rect.top) * (this.canvas.height / rect.height);

    return {
      x: rawX / this.canvas.width,  // Normalized 0.0 to 1.0
      y: rawY / this.canvas.height, // Normalized 0.0 to 1.0
      pixelX: rawX,
      pixelY: rawY
    };
  }

  handlePointerDown(e) {
    if (e.button !== 0) return; // Left click or touch only
    this.canvas.setPointerCapture(e.pointerId);

    const pt = this.getCanvasPoint(e);

    if (this.currentTool === 'text') {
      this.showTextInput(e.clientX, e.clientY, pt);
      return;
    }

    if (this.currentTool === 'eraser') {
      this.isDrawing = true;
      this.eraseAtPoint(pt);
      return;
    }

    this.isDrawing = true;
    this.startPoint = pt;

    if (this.currentTool === 'pen' || this.currentTool === 'highlighter') {
      this.activeStroke = {
        id: 'stroke_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        type: this.currentTool,
        color: this.currentColor,
        size: this.currentStrokeWidth,
        points: [{ x: pt.x, y: pt.y }]
      };
    }
  }

  handlePointerMove(e) {
    if (!this.isDrawing) return;
    const pt = this.getCanvasPoint(e);

    if (this.currentTool === 'eraser') {
      this.eraseAtPoint(pt);
      return;
    }

    if (this.currentTool === 'pen' || this.currentTool === 'highlighter') {
      if (this.activeStroke) {
        this.activeStroke.points.push({ x: pt.x, y: pt.y });
        this.redrawCurrentPage();
        this.drawAnnotationObject(this.ctx, this.activeStroke, this.canvas.width, this.canvas.height);
      }
      return;
    }

    // Shape live preview (line, arrow, rect)
    if (['line', 'arrow', 'rect'].includes(this.currentTool) && this.startPoint) {
      const tempShape = {
        type: this.currentTool,
        color: this.currentColor,
        size: this.currentStrokeWidth,
        startX: this.startPoint.x,
        startY: this.startPoint.y,
        endX: pt.x,
        endY: pt.y
      };
      this.redrawCurrentPage();
      this.drawAnnotationObject(this.ctx, tempShape, this.canvas.width, this.canvas.height);
    }
  }

  handlePointerUp(e) {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch (_) {}

    const pt = this.getCanvasPoint(e);

    if (this.currentTool === 'pen' || this.currentTool === 'highlighter') {
      if (this.activeStroke && this.activeStroke.points.length > 0) {
        this.addAnnotation(this.activeStroke);
      }
      this.activeStroke = null;
    } else if (['line', 'arrow', 'rect'].includes(this.currentTool) && this.startPoint) {
      // Avoid creating 0-size shapes on accidental micro clicks
      const dist = Math.hypot(pt.x - this.startPoint.x, pt.y - this.startPoint.y);
      if (dist > 0.005) {
        const shapeObj = {
          id: 'shape_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          type: this.currentTool,
          color: this.currentColor,
          size: this.currentStrokeWidth,
          startX: this.startPoint.x,
          startY: this.startPoint.y,
          endX: pt.x,
          endY: pt.y
        };
        this.addAnnotation(shapeObj);
      }
      this.startPoint = null;
      this.redrawCurrentPage();
    }
  }

  addAnnotation(annotationObj) {
    const page = this.currentPage;
    if (!this.pagesData[page]) this.pagesData[page] = [];
    if (!this.undoStacks[page]) this.undoStacks[page] = [];

    // Push action to undo stack
    this.undoStacks[page].push({
      action: 'add',
      item: annotationObj
    });
    // Clear redo stack on new action
    this.redoStacks[page] = [];

    this.pagesData[page].push(annotationObj);
    this.redrawCurrentPage();
    this.notifyStateChange();
  }

  eraseAtPoint(pt) {
    const page = this.currentPage;
    const items = this.pagesData[page];
    if (!items || items.length === 0) return;

    const threshold = (this.currentStrokeWidth * 3) / this.canvas.width + 0.012;
    let hitIndex = -1;

    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (this.isItemNearPoint(item, pt, threshold)) {
        hitIndex = i;
        break;
      }
    }

    if (hitIndex !== -1) {
      const removed = items.splice(hitIndex, 1)[0];
      this.undoStacks[page].push({
        action: 'remove',
        item: removed,
        index: hitIndex
      });
      this.redoStacks[page] = [];
      this.redrawCurrentPage();
      this.notifyStateChange();
    }
  }

  isItemNearPoint(item, pt, threshold) {
    if (item.type === 'pen' || item.type === 'highlighter') {
      return item.points.some(p => Math.hypot(p.x - pt.x, p.y - pt.y) <= threshold);
    }
    if (item.type === 'line' || item.type === 'arrow') {
      return this.distToSegment(pt.x, pt.y, item.startX, item.startY, item.endX, item.endY) <= threshold;
    }
    if (item.type === 'rect') {
      const minX = Math.min(item.startX, item.endX) - threshold;
      const maxX = Math.max(item.startX, item.endX) + threshold;
      const minY = Math.min(item.startY, item.endY) - threshold;
      const maxY = Math.max(item.startY, item.endY) + threshold;
      return pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY;
    }
    if (item.type === 'text') {
      // Approximate bounding box for text
      const boxW = 0.2;
      const boxH = 0.05;
      return pt.x >= item.x && pt.x <= item.x + boxW && pt.y >= item.y - boxH && pt.y <= item.y + boxH;
    }
    return false;
  }

  distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  showTextInput(screenX, screenY, normPt) {
    this.pendingTextCoord = normPt;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const relX = screenX - rect.left;
    const relY = screenY - rect.top;

    this.textOverlay.style.left = `${Math.min(relX, rect.width - 220)}px`;
    this.textOverlay.style.top = `${Math.min(relY, rect.height - 100)}px`;
    this.textOverlay.classList.remove('hidden');

    this.textArea.value = '';
    setTimeout(() => this.textArea.focus(), 50);
  }

  commitTextAnnotation() {
    if (!this.pendingTextCoord || !this.textArea) return;
    const text = this.textArea.value.trim();
    if (text) {
      const textObj = {
        id: 'text_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        type: 'text',
        text: text,
        color: this.currentColor,
        fontSize: Math.max(14, this.currentStrokeWidth * 4),
        x: this.pendingTextCoord.x,
        y: this.pendingTextCoord.y
      };
      this.addAnnotation(textObj);
    }
    this.cancelTextAnnotation();
  }

  cancelTextAnnotation() {
    if (this.textOverlay) {
      this.textOverlay.classList.add('hidden');
    }
    this.pendingTextCoord = null;
  }

  undo() {
    const page = this.currentPage;
    const stack = this.undoStacks[page];
    if (!stack || stack.length === 0) return;

    const op = stack.pop();
    if (op.action === 'add') {
      const idx = this.pagesData[page].findIndex(i => i.id === op.item.id);
      if (idx !== -1) {
        this.pagesData[page].splice(idx, 1);
      }
      this.redoStacks[page].push(op);
    } else if (op.action === 'remove') {
      this.pagesData[page].splice(op.index ?? this.pagesData[page].length, 0, op.item);
      this.redoStacks[page].push(op);
    } else if (op.action === 'clear') {
      this.pagesData[page] = [...op.items];
      this.redoStacks[page].push(op);
    }

    this.redrawCurrentPage();
    this.notifyStateChange();
  }

  redo() {
    const page = this.currentPage;
    const stack = this.redoStacks[page];
    if (!stack || stack.length === 0) return;

    const op = stack.pop();
    if (op.action === 'add') {
      this.pagesData[page].push(op.item);
      this.undoStacks[page].push(op);
    } else if (op.action === 'remove') {
      const idx = this.pagesData[page].findIndex(i => i.id === op.item.id);
      if (idx !== -1) {
        this.pagesData[page].splice(idx, 1);
      }
      this.undoStacks[page].push(op);
    } else if (op.action === 'clear') {
      this.pagesData[page] = [];
      this.undoStacks[page].push(op);
    }

    this.redrawCurrentPage();
    this.notifyStateChange();
  }

  clearSlide() {
    const page = this.currentPage;
    const items = this.pagesData[page] || [];
    if (items.length === 0) return;

    this.undoStacks[page].push({
      action: 'clear',
      items: [...items]
    });
    this.redoStacks[page] = [];
    this.pagesData[page] = [];

    this.redrawCurrentPage();
    this.notifyStateChange();
  }

  canUndo() {
    const stack = this.undoStacks[this.currentPage];
    return !!(stack && stack.length > 0);
  }

  canRedo() {
    const stack = this.redoStacks[this.currentPage];
    return !!(stack && stack.length > 0);
  }

  redrawCurrentPage() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const items = this.pagesData[this.currentPage] || [];
    for (const item of items) {
      this.drawAnnotationObject(this.ctx, item, this.canvas.width, this.canvas.height);
    }
  }

  drawAnnotationObject(ctx, item, w, h) {
    ctx.save();

    // Scale stroke width relative to base 1000px width
    const scaleFactor = w / 1000;
    const strokeW = Math.max(1, (item.size || 4) * scaleFactor);

    if (item.type === 'pen') {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = strokeW;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (item.points.length === 1) {
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(item.points[0].x * w, item.points[0].y * h, strokeW / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.points.length === 2) {
        ctx.beginPath();
        ctx.moveTo(item.points[0].x * w, item.points[0].y * h);
        ctx.lineTo(item.points[1].x * w, item.points[1].y * h);
        ctx.stroke();
      } else if (item.points.length > 2) {
        ctx.beginPath();
        ctx.moveTo(item.points[0].x * w, item.points[0].y * h);
        for (let i = 1; i < item.points.length - 1; i++) {
          const midX = ((item.points[i].x + item.points[i + 1].x) / 2) * w;
          const midY = ((item.points[i].y + item.points[i + 1].y) / 2) * h;
          ctx.quadraticCurveTo(item.points[i].x * w, item.points[i].y * h, midX, midY);
        }
        const last = item.points[item.points.length - 1];
        ctx.lineTo(last.x * w, last.y * h);
        ctx.stroke();
      }
    } else if (item.type === 'highlighter') {
      ctx.strokeStyle = this.hexToRgba(item.color, 0.38);
      ctx.lineWidth = strokeW * 2.8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (item.points.length === 1) {
        ctx.fillStyle = this.hexToRgba(item.color, 0.38);
        ctx.beginPath();
        ctx.arc(item.points[0].x * w, item.points[0].y * h, (strokeW * 2.8) / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.points.length === 2) {
        ctx.beginPath();
        ctx.moveTo(item.points[0].x * w, item.points[0].y * h);
        ctx.lineTo(item.points[1].x * w, item.points[1].y * h);
        ctx.stroke();
      } else if (item.points.length > 2) {
        ctx.beginPath();
        ctx.moveTo(item.points[0].x * w, item.points[0].y * h);
        for (let i = 1; i < item.points.length - 1; i++) {
          const midX = ((item.points[i].x + item.points[i + 1].x) / 2) * w;
          const midY = ((item.points[i].y + item.points[i + 1].y) / 2) * h;
          ctx.quadraticCurveTo(item.points[i].x * w, item.points[i].y * h, midX, midY);
        }
        const last = item.points[item.points.length - 1];
        ctx.lineTo(last.x * w, last.y * h);
        ctx.stroke();
      }
    } else if (item.type === 'line') {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = strokeW;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(item.startX * w, item.startY * h);
      ctx.lineTo(item.endX * w, item.endY * h);
      ctx.stroke();
    } else if (item.type === 'arrow') {
      ctx.strokeStyle = item.color;
      ctx.fillStyle = item.color;
      ctx.lineWidth = strokeW;
      ctx.lineCap = 'round';

      const x1 = item.startX * w;
      const y1 = item.startY * h;
      const x2 = item.endX * w;
      const y2 = item.endY * h;

      // Draw shaft
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Draw Arrow Head
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headLength = Math.max(12, strokeW * 3.5);

      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - headLength * Math.cos(angle - Math.PI / 6),
        y2 - headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        x2 - headLength * Math.cos(angle + Math.PI / 6),
        y2 - headLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    } else if (item.type === 'rect') {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = strokeW;
      ctx.lineJoin = 'round';

      const rx = Math.min(item.startX, item.endX) * w;
      const ry = Math.min(item.startY, item.endY) * h;
      const rw = Math.abs(item.endX - item.startX) * w;
      const rh = Math.abs(item.endY - item.startY) * h;

      ctx.strokeRect(rx, ry, rw, rh);
    } else if (item.type === 'text') {
      const fontSize = Math.max(12, (item.fontSize || 16) * scaleFactor);
      ctx.font = `600 ${fontSize}px Inter, sans-serif`;
      ctx.fillStyle = item.color;
      ctx.textBaseline = 'top';

      const lines = item.text.split('\n');
      const lineHeight = fontSize * 1.25;
      lines.forEach((line, index) => {
        ctx.fillText(line, item.x * w, item.y * h + index * lineHeight);
      });
    }

    ctx.restore();
  }

  hexToRgba(hex, alpha = 0.4) {
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange({
        currentPage: this.currentPage,
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        hasAnnotations: (this.pagesData[this.currentPage] || []).length > 0,
        totalAnnotatedSlides: Object.values(this.pagesData).filter(arr => arr && arr.length > 0).length
      });
    }
  }

  loadAllAnnotations(annotationsData) {
    this.pagesData = annotationsData || {};
    this.undoStacks = {};
    this.redoStacks = {};
    this.redrawCurrentPage();
    this.notifyStateChange();
  }

  getAllAnnotations() {
    return this.pagesData;
  }

  renderSlideToDataURL(pageNumber, width, height) {
    const items = this.pagesData[pageNumber];
    if (!items || items.length === 0) return null;

    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext('2d');

    for (const item of items) {
      this.drawAnnotationObject(offCtx, item, width, height);
    }

    return offscreen.toDataURL('image/png');
  }
}

window.CanvasManager = CanvasManager;

