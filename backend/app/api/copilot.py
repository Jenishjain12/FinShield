"""REST API endpoints for the AI Investigation Copilot.

Endpoints:
    POST /api/copilot/message — Query the Copilot with investigation context
    GET  /api/copilot/status  — Check whether the Gemini API key is configured
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.services.copilot import generate_copilot_response

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/copilot")


class HistoryItem(BaseModel):
    role: str = Field(description="Role: 'user' or 'assistant'")
    content: str = Field(max_length=4000, description="Message text")


class CopilotQueryRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000, description="User question or prompt for Copilot")
    advertisement_id: str | None = Field(default=None, description="Optional advertisement ID to ground analysis on")
    compare_ad_id: str | None = Field(default=None, description="Optional second advertisement ID for comparison")
    conversation_history: list[HistoryItem] = Field(default=[], description="Previous conversation turns (max 10)")


class CopilotQueryResponse(BaseModel):
    answer: str
    evidence_references: list[dict[str, Any]] = []
    advertisement_id: str | None = None
    model_used: str = ""
    error: str | None = None


class CopilotStatusResponse(BaseModel):
    is_configured: bool
    model: str
    description: str


@router.get("/status", response_model=CopilotStatusResponse)
def get_copilot_status():
    """Return whether the API key is configured and which model is active."""
    settings = get_settings()
    has_nvidia = bool(settings.nvidia_api_key and settings.nvidia_api_key.strip())
    has_gemini = bool(settings.gemini_api_key and settings.gemini_api_key.strip())

    if has_nvidia:
        return CopilotStatusResponse(
            is_configured=True,
            model=settings.nvidia_model,
            description=f"NVIDIA Nemotron AI Copilot ({settings.nvidia_model})",
        )

    if has_gemini:
        if settings.gemini_api_key.startswith("gsk_"):
            model = (
                settings.gemini_model
                if settings.gemini_model and not settings.gemini_model.startswith("gemini")
                else "openai/gpt-oss-120b"
            )
            return CopilotStatusResponse(
                is_configured=True,
                model=model,
                description=f"Groq Cloud AI Copilot ({model})",
            )
        return CopilotStatusResponse(
            is_configured=True,
            model=settings.gemini_model,
            description="Google Gemini API AI Investigation Copilot",
        )

    return CopilotStatusResponse(
        is_configured=False,
        model=settings.nvidia_model,
        description="NVIDIA_API_KEY is not configured in backend environment",
    )


@router.post("/message", response_model=CopilotQueryResponse)
async def send_copilot_message(
    body: CopilotQueryRequest,
    db: Session = Depends(get_db),
):
    """Send an investigator query to the AI Copilot grounded in database evidence."""
    # Convert history
    history = [{"role": h.role, "content": h.content} for h in body.conversation_history[-10:]]

    result = await generate_copilot_response(
        db=db,
        user_query=body.message,
        advertisement_id=body.advertisement_id,
        compare_ad_id=body.compare_ad_id,
        conversation_history=history,
    )

    if result.error and "not configured" in result.error.lower():
        # Return 200 with structured error message so frontend shows clean configuration guidance
        return CopilotQueryResponse(
            answer="",
            evidence_references=[],
            advertisement_id=body.advertisement_id,
            model_used="",
            error=result.error,
        )

    if result.error and "not found" in result.error.lower():
        raise HTTPException(status_code=404, detail=result.error)

    return CopilotQueryResponse(
        answer=result.answer,
        evidence_references=result.evidence_references,
        advertisement_id=result.advertisement_id,
        model_used=result.model_used,
        error=result.error,
    )
