/**
 * StorageManager - Handles local autosave and backend API sync for projects.
 */
class StorageManager {
  static getLocalKey(projectId) {
    return `ccppt_project_${projectId}`;
  }

  static saveLocal(projectId, projectData) {
    if (!projectId) return;
    try {
      const serialized = JSON.stringify({
        ...projectData,
        _cachedAt: new Date().toISOString()
      });
      localStorage.setItem(this.getLocalKey(projectId), serialized);
    } catch (e) {
      console.warn('LocalStorage save failed (possible quota exceeded):', e);
    }
  }

  static loadLocal(projectId) {
    if (!projectId) return null;
    try {
      const data = localStorage.getItem(this.getLocalKey(projectId));
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Failed to parse local project:', e);
      return null;
    }
  }

  static async saveServer(projectId, projectData) {
    const res = await fetch(`/api/project/${projectId}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Gagal menyimpan ke server');
    }
    return await res.json();
  }

  static async loadServer(projectId) {
    const res = await fetch(`/api/project/${projectId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Gagal memuat proyek dari server');
    }
    return await res.json();
  }

  static async saveSlideServer(projectId, pageNumber, annotations) {
    const res = await fetch(`/api/project/${projectId}/slide/${pageNumber}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ annotations })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Gagal menyimpan anotasi slide');
    }
    return await res.json();
  }

  static async listServerProjects() {
    const res = await fetch('/api/projects');
    if (!res.ok) throw new Error('Gagal memuat daftar proyek');
    const data = await res.json();
    return data.projects || [];
  }

  static async importProjectFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/project/import', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Gagal mengimpor file proyek');
    }
    return await res.json();
  }
}

window.StorageManager = StorageManager;

