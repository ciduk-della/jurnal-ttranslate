"""
Language detection module for the AI Journal Translator.
Uses the langdetect library for reliable language identification.
"""

from langdetect import detect as ld_detect
from langdetect import detect_langs as ld_detect_langs
from langdetect import LangDetectException


class LanguageDetector:
    """Detects the language of text with confidence scoring."""

    LANGUAGE_MAP = {
        "af": "Afrikaans",
        "ar": "Arabic",
        "bg": "Bulgarian",
        "bn": "Bengali",
        "ca": "Catalan",
        "cs": "Czech",
        "cy": "Welsh",
        "da": "Danish",
        "de": "German",
        "el": "Greek",
        "en": "English",
        "es": "Spanish",
        "et": "Estonian",
        "fa": "Persian",
        "fi": "Finnish",
        "fr": "French",
        "gu": "Gujarati",
        "he": "Hebrew",
        "hi": "Hindi",
        "hr": "Croatian",
        "hu": "Hungarian",
        "id": "Indonesian",
        "it": "Italian",
        "ja": "Japanese",
        "kn": "Kannada",
        "ko": "Korean",
        "lt": "Lithuanian",
        "lv": "Latvian",
        "mk": "Macedonian",
        "ml": "Malayalam",
        "mr": "Marathi",
        "ms": "Malay",
        "ne": "Nepali",
        "nl": "Dutch",
        "no": "Norwegian",
        "pa": "Punjabi",
        "pl": "Polish",
        "pt": "Portuguese",
        "ro": "Romanian",
        "ru": "Russian",
        "sk": "Slovak",
        "sl": "Slovenian",
        "so": "Somali",
        "sq": "Albanian",
        "sv": "Swedish",
        "sw": "Swahili",
        "ta": "Tamil",
        "te": "Telugu",
        "th": "Thai",
        "tl": "Tagalog",
        "tr": "Turkish",
        "uk": "Ukrainian",
        "ur": "Urdu",
        "vi": "Vietnamese",
        "zh-cn": "Chinese (Simplified)",
        "zh-tw": "Chinese (Traditional)",
    }

    MIN_TEXT_LENGTH = 20

    def __init__(self):
        pass

    def detect(self, text):
        """
        Detect the language of the given text.

        Args:
            text: Text string to analyse.

        Returns:
            dict with 'language' (ISO code), 'language_name', 'confidence' (0-1).
            On failure returns language='unknown' with confidence 0.
        """
        if not text or not isinstance(text, str):
            return {
                "language": "unknown",
                "language_name": "Unknown",
                "confidence": 0.0,
            }

        cleaned = text.strip()
        if len(cleaned) < self.MIN_TEXT_LENGTH:
            # Attempt detection but flag low confidence
            try:
                results = ld_detect_langs(cleaned)
                if results:
                    best = results[0]
                    lang_code = str(best.lang)
                    return {
                        "language": lang_code,
                        "language_name": self.LANGUAGE_MAP.get(lang_code, lang_code.title()),
                        "confidence": round(float(best.prob) * 0.5, 4),  # halved due to short text
                    }
            except LangDetectException:
                pass
            return {
                "language": "unknown",
                "language_name": "Unknown",
                "confidence": 0.0,
            }

        try:
            results = ld_detect_langs(cleaned)
            if not results:
                return {
                    "language": "unknown",
                    "language_name": "Unknown",
                    "confidence": 0.0,
                }
            best = results[0]
            lang_code = str(best.lang)
            return {
                "language": lang_code,
                "language_name": self.LANGUAGE_MAP.get(lang_code, lang_code.title()),
                "confidence": round(float(best.prob), 4),
            }
        except LangDetectException:
            return {
                "language": "unknown",
                "language_name": "Unknown",
                "confidence": 0.0,
            }

    def get_supported_languages(self):
        """
        Return the list of languages this detector can identify.

        Returns:
            List of dicts with 'code' and 'name' keys.
        """
        return [
            {"code": code, "name": name}
            for code, name in sorted(self.LANGUAGE_MAP.items(), key=lambda x: x[1])
        ]
