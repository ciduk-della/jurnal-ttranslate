import os
import json
import uuid
import re
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from config import Config

class AnnotationService:
    @staticmethod
    def _sanitize_id(project_id: str) -> str:
        """Sanitize project_id to prevent path traversal."""
        sanitized = re.sub(r'[^a-zA-Z0-9_\-]', '', project_id)
        if not sanitized:
            raise ValueError("Invalid project ID")
        return sanitized

    @classmethod
    def get_project_file_path(cls, project_id: str) -> str:
        safe_id = cls._sanitize_id(project_id)
        return os.path.join(Config.PROJECTS_FOLDER, f"{safe_id}.json")

    @classmethod
    def create_project(cls, original_filename: str, pdf_filename: str, total_pages: int, project_id: Optional[str] = None, pages_meta: Optional[list] = None) -> Dict[str, Any]:
        """
        Create a new annotation project manifest.
        """
        pid = cls._sanitize_id(project_id) if project_id else str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        project_data = {
            "project_id": pid,
            "title": os.path.splitext(original_filename)[0],
            "original_filename": original_filename,
            "pdf_filename": pdf_filename,
            "total_pages": total_pages,
            "pages_meta": pages_meta or [],
            "created_at": now,
            "updated_at": now,
            "annotations": {}
        }
        
        cls.save_project(pid, project_data)
        return project_data

    @classmethod
    def save_project(cls, project_id: str, data: Dict[str, Any]) -> str:
        """
        Save or update project data and annotations to disk.
        """
        safe_id = cls._sanitize_id(project_id)
        file_path = cls.get_project_file_path(safe_id)
        
        # Ensure timestamp is updated
        data["project_id"] = safe_id
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        # Ensure annotations dict exists
        if "annotations" not in data or not isinstance(data["annotations"], dict):
            data["annotations"] = {}

        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
        return file_path

    @classmethod
    def load_project(cls, project_id: str) -> Dict[str, Any]:
        """
        Load project data by ID.
        """
        file_path = cls.get_project_file_path(project_id)
        if not os.path.isfile(file_path):
            raise FileNotFoundError(f"Proyek dengan ID {project_id} tidak ditemukan.")
            
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        return data

    @classmethod
    def update_slide_annotations(cls, project_id: str, page_number: int, slide_annotations: list) -> Dict[str, Any]:
        """
        Update annotations for a specific slide number (1-indexed).
        """
        project = cls.load_project(project_id)
        page_key = str(page_number)
        project["annotations"][page_key] = slide_annotations
        cls.save_project(project_id, project)
        return project

    @classmethod
    def list_projects(cls) -> list:
        """
        List all saved projects with brief summary.
        """
        projects = []
        if not os.path.exists(Config.PROJECTS_FOLDER):
            return projects
            
        for fname in os.listdir(Config.PROJECTS_FOLDER):
            if fname.endswith('.json'):
                fpath = os.path.join(Config.PROJECTS_FOLDER, fname)
                try:
                    with open(fpath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        total_annotated = len(data.get("annotations", {}))
                        projects.append({
                            "project_id": data.get("project_id", os.path.splitext(fname)[0]),
                            "title": data.get("title", "Tanpa Judul"),
                            "original_filename": data.get("original_filename", ""),
                            "pdf_filename": data.get("pdf_filename", ""),
                            "total_pages": data.get("total_pages", 0),
                            "annotated_pages_count": total_annotated,
                            "updated_at": data.get("updated_at", "")
                        })
                except Exception:
                    continue
                    
        # Sort by updated_at descending
        projects.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        return projects
