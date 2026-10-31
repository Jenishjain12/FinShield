from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models import Advertisement
from app.schemas.common import AdvertisementDetail
from app.services.analysis import analyze_advertisement
from app.services.ocr import inspect_image_file, validate_image
from app.services.serializers import detail

router = APIRouter()


@router.post("/analyze", response_model=AdvertisementDetail)
async def analyze(
    text: str = Form(default=""),
    source: str | None = Form(default=None),
    source_url: str | None = Form(default=None),
    image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
) -> AdvertisementDetail:
    settings = get_settings()
    cleaned_text = (text or "").strip()
    cleaned_url = (source_url or "").strip() or None
    image_filename = None

    if image and image.filename:
        payload = await image.read()
        error = validate_image(image.filename, image.content_type, len(payload), settings.max_upload_bytes)
        if error:
            raise HTTPException(status_code=400, detail=error)
        suffix = Path(image.filename).suffix.lower()
        image_filename = f"{uuid.uuid4()}{suffix}"
        upload_dir = Path(settings.upload_dir)
        upload_dir.mkdir(parents=True, exist_ok=True)
        path = upload_dir / image_filename
        path.write_bytes(payload)
        inspect_error = inspect_image_file(path)
        if inspect_error:
            path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail=inspect_error)

    if not cleaned_text and not image_filename:
        raise HTTPException(status_code=400, detail="Provide advertisement text or an image.")

    ad = Advertisement(
        text=cleaned_text,
        source=(source or "").strip() or None,
        source_url=cleaned_url,
        image_filename=image_filename,
        is_seed=False,
        analysis_status="processing",
    )
    db.add(ad)
    db.flush()
    analyze_advertisement(db, ad)
    db.commit()
    db.refresh(ad)
    return detail(db, ad)
