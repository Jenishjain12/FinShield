from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, UnidentifiedImageError


ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


@dataclass
class OcrResult:
    text: str | None
    status: str
    limitation: str | None = None


def validate_image(filename: str, content_type: str | None, size: int, max_bytes: int) -> str | None:
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        return "Unsupported file type. Upload a JPEG, PNG, or WebP image."
    if content_type and content_type not in ALLOWED_IMAGE_TYPES:
        return "Unsupported content type. Upload a JPEG, PNG, or WebP image."
    if size <= 0:
        return "Uploaded file is empty."
    if size > max_bytes:
        return f"File exceeds the {max_bytes // (1024 * 1024)} MB limit."
    return None


def inspect_image_file(path: Path) -> str | None:
    try:
        with Image.open(path) as image:
            image.verify()
    except (UnidentifiedImageError, OSError):
        return "The uploaded file could not be read as an image."
    return None


def extract_text_from_image(path: Path) -> OcrResult:
    try:
        import pytesseract  # type: ignore
    except ImportError:
        return OcrResult(
            text=None,
            status="unavailable",
            limitation="OCR is unavailable because pytesseract is not installed. Text analysis still works if advertisement copy is provided.",
        )

    try:
        with Image.open(path) as image:
            text = pytesseract.image_to_string(image).strip()
    except Exception as exc:  # pragma: no cover - depends on local tesseract
        return OcrResult(
            text=None,
            status="failed",
            limitation=f"OCR could not be completed ({exc.__class__.__name__}). Provide advertisement text for analysis.",
        )

    if not text:
        return OcrResult(
            text=None,
            status="empty",
            limitation="OCR completed but extracted no readable text from the image.",
        )
    return OcrResult(text=text, status="extracted")
