"""
Civil Engineering Academic Terminology Manager.
Provides consistent translation of domain-specific terms between English and Indonesian.
"""

import json
import os
import re


class TerminologyManager:
    """Manages civil engineering academic terminology for consistent translations."""

    def __init__(self, custom_terms_path=None):
        """
        Initialize the terminology manager with default and optional custom terms.

        Args:
            custom_terms_path: Optional path to a JSON file with custom terms.
        """
        self._default_terms = self._build_default_dictionary()
        self._custom_terms = {}
        self._custom_terms_path = custom_terms_path

        if custom_terms_path and os.path.exists(custom_terms_path):
            self.load_custom_terms(custom_terms_path)

    def _build_default_dictionary(self):
        """Build the default English→Indonesian civil engineering terminology dictionary."""
        terms = {}

        # --- Structural Engineering ---
        structural = {
            "shear force": "gaya geser",
            "bending moment": "momen lentur",
            "reinforced concrete": "beton bertulang",
            "prestressed concrete": "beton prategang",
            "yield strength": "kuat leleh",
            "ultimate strength": "kuat ultimit",
            "ductility": "daktilitas",
            "buckling": "tekuk",
            "deflection": "lendutan",
            "load combination": "kombinasi pembebanan",
            "structural analysis": "analisis struktur",
            "shear wall": "dinding geser",
            "moment resisting frame": "rangka pemikul momen",
            "tensile strength": "kuat tarik",
            "compressive strength": "kuat tekan",
            "modulus of elasticity": "modulus elastisitas",
            "stress": "tegangan",
            "strain": "regangan",
            "torsion": "torsi/puntir",
            "axial load": "beban aksial",
            "lateral load": "beban lateral",
            "cyclic loading": "pembebanan siklik",
            "pemuatan siklik": "pembebanan siklik",
            "beban siklik": "pembebanan siklik",
            "monotonic loading": "pembebanan monotonik",
            "dead load": "beban mati",
            "live load": "beban hidup",
            "wind load": "beban angin",
            "earthquake load": "beban gempa",
            "seismic": "seismik",
            "column": "kolom",
            "beam": "balok",
            "slab": "pelat",
            "foundation": "pondasi",
            "pile": "tiang pancang",
            "footing": "tapak pondasi",
            "reinforcement": "tulangan",
            "stirrup": "sengkang",
            "rebar": "baja tulangan",
            "concrete cover": "selimut beton",
            "splice": "sambungan",
            "anchorage": "penjangkaran",
            "bond strength": "kuat lekat",
            "crack": "retak",
            "creep": "rangkak",
            "shrinkage": "susut",
            "fatigue": "kelelahan",
            "plastic hinge": "sendi plastis",
            "natural frequency": "frekuensi natural",
            "damping ratio": "rasio redaman",
            "response spectrum": "spektrum respons",
            "base shear": "gaya geser dasar",
            "story drift": "simpangan antar lantai",
            "ductility factor": "faktor daktilitas",
        }
        terms.update(structural)

        # --- Geotechnical Engineering ---
        geotechnical = {
            "bearing capacity": "daya dukung",
            "soil liquefaction": "likuifaksi tanah",
            "settlement": "penurunan",
            "consolidation": "konsolidasi",
            "permeability": "permeabilitas",
            "shear strength": "kuat geser",
            "cohesion": "kohesi",
            "angle of friction": "sudut geser",
            "groundwater": "air tanah",
            "retaining wall": "dinding penahan tanah",
            "slope stability": "stabilitas lereng",
            "soil mechanics": "mekanika tanah",
            "clay": "tanah lempung",
            "sand": "pasir",
            "gravel": "kerikil",
            "silt": "lanau",
            "rock mechanics": "mekanika batuan",
            "geosynthetics": "geosintetik",
            "embankment": "timbunan",
            "excavation": "galian",
        }
        terms.update(geotechnical)

        # --- Hydraulic / Water Engineering ---
        hydraulic = {
            "hydraulic": "hidraulik",
            "flow rate": "debit aliran",
            "discharge": "debit",
            "open channel": "saluran terbuka",
            "pipe flow": "aliran pipa",
            "reynolds number": "bilangan Reynolds",
            "froude number": "bilangan Froude",
            "weir": "bendung",
            "dam": "bendungan",
            "spillway": "pelimpah",
            "flood": "banjir",
            "drainage": "drainase",
            "watershed": "daerah aliran sungai",
            "irrigation": "irigasi",
            "water treatment": "pengolahan air",
            "sedimentation": "sedimentasi",
            "erosion": "erosi",
        }
        terms.update(hydraulic)

        # --- Transportation ---
        transportation = {
            "traffic flow": "arus lalu lintas",
            "pavement": "perkerasan",
            "asphalt": "aspal",
            "highway": "jalan raya",
            "intersection": "persimpangan",
            "geometric design": "desain geometrik",
            "level of service": "tingkat pelayanan",
            "speed": "kecepatan",
            "volume": "volume",
            "capacity": "kapasitas",
            "sight distance": "jarak pandang",
        }
        terms.update(transportation)

        # --- Construction & Management ---
        construction = {
            "project management": "manajemen proyek",
            "cost estimation": "estimasi biaya",
            "scheduling": "penjadwalan",
            "quality control": "pengendalian mutu",
            "safety": "keselamatan",
            "work breakdown structure": "struktur rincian kerja",
            "critical path method": "metode jalur kritis",
            "building information modeling": "pemodelan informasi bangunan",
        }
        terms.update(construction)

        # --- General Academic ---
        academic = {
            "finite element method": "Metode Elemen Hingga",
            "methodology": "metodologi",
            "literature review": "tinjauan pustaka",
            "hypothesis": "hipotesis",
            "conclusion": "kesimpulan",
            "abstract": "abstrak",
            "experimental": "eksperimental",
            "numerical analysis": "analisis numerik",
            "parametric study": "studi parametrik",
            "validation": "validasi",
            "calibration": "kalibrasi",
            "simulation": "simulasi",
            "optimization": "optimasi",
            "regression": "regresi",
            "correlation": "korelasi",
            "standard deviation": "deviasi standar",
            "coefficient": "koefisien",
            "specimen": "benda uji",
            "prototype": "prototipe",
            "scale model": "model skala",
        }
        terms.update(academic)

        return terms

    def _get_merged_terms(self):
        """Return merged dictionary with custom terms taking priority over defaults."""
        merged = dict(self._default_terms)
        merged.update(self._custom_terms)
        return merged

    def translate_term(self, term, source_lang="en", target_lang="id"):
        """
        Translate a single term between languages.

        Args:
            term: The term to translate.
            source_lang: Source language code ('en' or 'id').
            target_lang: Target language code ('en' or 'id').

        Returns:
            Translated term string, or None if not found.
        """
        merged = self._get_merged_terms()
        term_lower = term.lower().strip()

        if source_lang == "en" and target_lang == "id":
            for key, value in merged.items():
                if key.lower() == term_lower:
                    return value
        elif source_lang == "id" and target_lang == "en":
            for key, value in merged.items():
                if value.lower() == term_lower:
                    return key
        return None

    def add_term(self, english, indonesian):
        """
        Add a custom term to the terminology dictionary.

        Args:
            english: English term.
            indonesian: Indonesian translation.
        """
        self._custom_terms[english.lower().strip()] = indonesian.strip()
        if self._custom_terms_path:
            self.save_custom_terms(self._custom_terms_path)

    def remove_term(self, english):
        """
        Remove a custom term from the terminology dictionary.

        Args:
            english: English term to remove.

        Returns:
            True if removed, False if not found in custom terms.
        """
        key = english.lower().strip()
        if key in self._custom_terms:
            del self._custom_terms[key]
            if self._custom_terms_path:
                self.save_custom_terms(self._custom_terms_path)
            return True
        return False

    def get_all_terms(self):
        """
        Return all terminology as a list of dicts.

        Returns:
            List of dicts with 'english', 'indonesian', and 'is_custom' keys.
        """
        result = []
        merged = self._get_merged_terms()
        for english, indonesian in sorted(merged.items()):
            result.append({
                "english": english,
                "indonesian": indonesian,
                "is_custom": english in self._custom_terms,
            })
        return result

    def apply_terminology(self, text, source_lang="en", target_lang="id"):
        """
        Post-process translated text by replacing known terms with their
        correct domain-specific translations. Uses word boundary matching
        to avoid partial replacements.

        Args:
            text: The translated text to post-process.
            source_lang: Source language of the terms to find.
            target_lang: Target language to replace with.

        Returns:
            Text with terminology applied.
        """
        if not text:
            return text

        merged = self._get_merged_terms()

        if source_lang == "en" and target_lang == "id":
            pairs = sorted(merged.items(), key=lambda x: len(x[0]), reverse=True)
            for source_term, target_term in pairs:
                pattern = re.compile(
                    r'\b' + re.escape(source_term) + r'\b',
                    re.IGNORECASE
                )
                text = pattern.sub(target_term, text)
        elif source_lang == "id" and target_lang == "en":
            reverse_pairs = sorted(
                merged.items(), key=lambda x: len(x[1]), reverse=True
            )
            for english_term, indo_term in reverse_pairs:
                pattern = re.compile(
                    r'\b' + re.escape(indo_term) + r'\b',
                    re.IGNORECASE
                )
                text = pattern.sub(english_term, text)

        return text

    def save_custom_terms(self, path):
        """
        Save custom terms to a JSON file.

        Args:
            path: File path to save to.
        """
        os.makedirs(os.path.dirname(path) if os.path.dirname(path) else ".", exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self._custom_terms, f, ensure_ascii=False, indent=2)

    def load_custom_terms(self, path):
        """
        Load custom terms from a JSON file.

        Args:
            path: File path to load from.
        """
        try:
            with open(path, "r", encoding="utf-8") as f:
                self._custom_terms = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            self._custom_terms = {}
