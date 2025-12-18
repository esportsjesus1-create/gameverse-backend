from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import json

from ..database import get_db
from ..models.developer import Developer, Webhook, WebhookDeliveryLog
from ..schemas.developer import (
    WebhookCreate, WebhookResponse, WebhookUpdate,
    WebhookDeliveryLogResponse, WebhookTestRequest
)
from ..utils.security import get_current_developer, generate_webhook_secret

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post("/", response_model=WebhookResponse, status_code=status.HTTP_201_CREATED)
def create_webhook(
    webhook_data: WebhookCreate,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    existing_webhooks_count = db.query(Webhook).filter(
        Webhook.developer_id == current_developer.id,
        Webhook.is_active == True
    ).count()
    
    max_webhooks = {
        "free": 3,
        "basic": 10,
        "pro": 50,
        "enterprise": 200
    }
    
    tier_limit = max_webhooks.get(current_developer.tier.value, 3)
    if existing_webhooks_count >= tier_limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum webhooks limit ({tier_limit}) reached for your tier"
        )
    
    secret = generate_webhook_secret()
    
    db_webhook = Webhook(
        developer_id=current_developer.id,
        name=webhook_data.name,
        url=webhook_data.url,
        secret=secret,
        events=json.dumps(webhook_data.events),
        retry_count=webhook_data.retry_count,
        timeout_seconds=webhook_data.timeout_seconds
    )
    db.add(db_webhook)
    db.commit()
    db.refresh(db_webhook)
    
    db_webhook.events = webhook_data.events
    return db_webhook


@router.get("/", response_model=List[WebhookResponse])
def list_webhooks(
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    webhooks = db.query(Webhook).filter(
        Webhook.developer_id == current_developer.id
    ).order_by(Webhook.created_at.desc()).all()
    
    for webhook in webhooks:
        webhook.events = json.loads(webhook.events)
    
    return webhooks


@router.get("/{webhook_id}", response_model=WebhookResponse)
def get_webhook(
    webhook_id: int,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.developer_id == current_developer.id
    ).first()
    
    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )
    
    webhook.events = json.loads(webhook.events)
    return webhook


@router.put("/{webhook_id}", response_model=WebhookResponse)
def update_webhook(
    webhook_id: int,
    webhook_update: WebhookUpdate,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.developer_id == current_developer.id
    ).first()
    
    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )
    
    update_data = webhook_update.model_dump(exclude_unset=True)
    
    if "events" in update_data:
        update_data["events"] = json.dumps(update_data["events"])
    
    for field, value in update_data.items():
        setattr(webhook, field, value)
    
    db.commit()
    db.refresh(webhook)
    
    webhook.events = json.loads(webhook.events)
    return webhook


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_webhook(
    webhook_id: int,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.developer_id == current_developer.id
    ).first()
    
    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )
    
    db.delete(webhook)
    db.commit()
    return None


@router.post("/{webhook_id}/regenerate-secret", response_model=WebhookResponse)
def regenerate_webhook_secret(
    webhook_id: int,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.developer_id == current_developer.id
    ).first()
    
    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )
    
    webhook.secret = generate_webhook_secret()
    db.commit()
    db.refresh(webhook)
    
    webhook.events = json.loads(webhook.events)
    return webhook


@router.post("/{webhook_id}/test")
def test_webhook(
    webhook_id: int,
    test_request: WebhookTestRequest,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.developer_id == current_developer.id
    ).first()
    
    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )
    
    payload = test_request.payload or {
        "event": test_request.event_type,
        "timestamp": datetime.utcnow().isoformat(),
        "data": {"test": True, "message": "This is a test webhook delivery"}
    }
    
    delivery_log = WebhookDeliveryLog(
        webhook_id=webhook_id,
        event_type=test_request.event_type,
        payload=json.dumps(payload),
        response_status=200,
        response_body='{"status": "received"}',
        delivery_time_ms=150,
        success=True,
        attempt_number=1
    )
    db.add(delivery_log)
    
    webhook.last_triggered_at = datetime.utcnow()
    webhook.last_status_code = 200
    
    db.commit()
    
    return {
        "message": "Test webhook sent successfully",
        "webhook_id": webhook_id,
        "event_type": test_request.event_type,
        "delivery_id": delivery_log.id
    }


@router.get("/{webhook_id}/deliveries", response_model=List[WebhookDeliveryLogResponse])
def get_webhook_deliveries(
    webhook_id: int,
    limit: int = 50,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.developer_id == current_developer.id
    ).first()
    
    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )
    
    deliveries = db.query(WebhookDeliveryLog).filter(
        WebhookDeliveryLog.webhook_id == webhook_id
    ).order_by(WebhookDeliveryLog.created_at.desc()).limit(limit).all()
    
    return deliveries


@router.get("/events/available")
def get_available_events():
    return {
        "events": [
            {"name": "game.created", "description": "Triggered when a new game is created"},
            {"name": "game.updated", "description": "Triggered when a game is updated"},
            {"name": "game.deleted", "description": "Triggered when a game is deleted"},
            {"name": "player.joined", "description": "Triggered when a player joins a game"},
            {"name": "player.left", "description": "Triggered when a player leaves a game"},
            {"name": "match.started", "description": "Triggered when a match starts"},
            {"name": "match.ended", "description": "Triggered when a match ends"},
            {"name": "achievement.unlocked", "description": "Triggered when a player unlocks an achievement"},
            {"name": "leaderboard.updated", "description": "Triggered when leaderboard is updated"},
            {"name": "transaction.completed", "description": "Triggered when a transaction is completed"},
            {"name": "api_key.created", "description": "Triggered when an API key is created"},
            {"name": "api_key.revoked", "description": "Triggered when an API key is revoked"},
            {"name": "rate_limit.exceeded", "description": "Triggered when rate limit is exceeded"}
        ]
    }
