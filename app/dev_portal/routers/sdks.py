from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..models.developer import Developer, SDK, SDKDownload
from ..schemas.developer import SDKCreate, SDKResponse, SDKUpdate
from ..utils.security import get_current_developer

router = APIRouter(prefix="/sdks", tags=["SDK Management"])


@router.get("/", response_model=List[SDKResponse])
def list_sdks(
    language: Optional[str] = None,
    include_deprecated: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(SDK)
    
    if language:
        query = query.filter(SDK.language == language)
    
    if not include_deprecated:
        query = query.filter(SDK.is_deprecated == False)
    
    sdks = query.order_by(SDK.language, SDK.name, SDK.version.desc()).all()
    return sdks


@router.get("/languages")
def get_available_languages(db: Session = Depends(get_db)):
    languages = db.query(SDK.language).distinct().all()
    return {
        "languages": [lang[0] for lang in languages],
        "supported_languages": [
            {"name": "JavaScript", "code": "javascript"},
            {"name": "TypeScript", "code": "typescript"},
            {"name": "Python", "code": "python"},
            {"name": "Java", "code": "java"},
            {"name": "C#", "code": "csharp"},
            {"name": "Go", "code": "go"},
            {"name": "Rust", "code": "rust"},
            {"name": "PHP", "code": "php"},
            {"name": "Ruby", "code": "ruby"},
            {"name": "Swift", "code": "swift"},
            {"name": "Kotlin", "code": "kotlin"},
            {"name": "Unity (C#)", "code": "unity"},
            {"name": "Unreal (C++)", "code": "unreal"}
        ]
    }


@router.get("/{sdk_id}", response_model=SDKResponse)
def get_sdk(sdk_id: int, db: Session = Depends(get_db)):
    sdk = db.query(SDK).filter(SDK.id == sdk_id).first()
    
    if not sdk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SDK not found"
        )
    
    return sdk


@router.post("/", response_model=SDKResponse, status_code=status.HTTP_201_CREATED)
def create_sdk(
    sdk_data: SDKCreate,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    if current_developer.tier.value not in ["pro", "enterprise"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Pro and Enterprise tier developers can create SDKs"
        )
    
    existing = db.query(SDK).filter(
        SDK.name == sdk_data.name,
        SDK.language == sdk_data.language,
        SDK.version == sdk_data.version
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SDK with this name, language, and version already exists"
        )
    
    db_sdk = SDK(
        name=sdk_data.name,
        language=sdk_data.language,
        version=sdk_data.version,
        description=sdk_data.description,
        download_url=sdk_data.download_url,
        documentation_url=sdk_data.documentation_url,
        changelog=sdk_data.changelog,
        min_runtime_version=sdk_data.min_runtime_version,
        is_stable=sdk_data.is_stable
    )
    db.add(db_sdk)
    db.commit()
    db.refresh(db_sdk)
    
    return db_sdk


@router.put("/{sdk_id}", response_model=SDKResponse)
def update_sdk(
    sdk_id: int,
    sdk_update: SDKUpdate,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    if current_developer.tier.value not in ["pro", "enterprise"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Pro and Enterprise tier developers can update SDKs"
        )
    
    sdk = db.query(SDK).filter(SDK.id == sdk_id).first()
    
    if not sdk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SDK not found"
        )
    
    update_data = sdk_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(sdk, field, value)
    
    db.commit()
    db.refresh(sdk)
    return sdk


@router.delete("/{sdk_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sdk(
    sdk_id: int,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    if current_developer.tier.value != "enterprise":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Enterprise tier developers can delete SDKs"
        )
    
    sdk = db.query(SDK).filter(SDK.id == sdk_id).first()
    
    if not sdk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SDK not found"
        )
    
    db.delete(sdk)
    db.commit()
    return None


@router.post("/{sdk_id}/download")
def download_sdk(
    sdk_id: int,
    request: Request,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    sdk = db.query(SDK).filter(SDK.id == sdk_id).first()
    
    if not sdk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SDK not found"
        )
    
    if sdk.is_deprecated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This SDK version is deprecated. Please use a newer version."
        )
    
    download_log = SDKDownload(
        sdk_id=sdk_id,
        developer_id=current_developer.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    db.add(download_log)
    
    sdk.download_count += 1
    db.commit()
    
    return {
        "sdk_id": sdk_id,
        "name": sdk.name,
        "version": sdk.version,
        "download_url": sdk.download_url,
        "documentation_url": sdk.documentation_url,
        "message": "Download initiated"
    }


@router.get("/{sdk_id}/downloads")
def get_sdk_downloads(
    sdk_id: int,
    limit: int = Query(default=100, le=1000),
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    if current_developer.tier.value not in ["pro", "enterprise"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Pro and Enterprise tier developers can view download statistics"
        )
    
    sdk = db.query(SDK).filter(SDK.id == sdk_id).first()
    
    if not sdk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SDK not found"
        )
    
    downloads = db.query(SDKDownload).filter(
        SDKDownload.sdk_id == sdk_id
    ).order_by(SDKDownload.created_at.desc()).limit(limit).all()
    
    return {
        "sdk_id": sdk_id,
        "total_downloads": sdk.download_count,
        "recent_downloads": [
            {
                "id": d.id,
                "developer_id": d.developer_id,
                "downloaded_at": d.created_at.isoformat()
            }
            for d in downloads
        ]
    }


@router.get("/latest/{language}")
def get_latest_sdk(language: str, db: Session = Depends(get_db)):
    sdk = db.query(SDK).filter(
        SDK.language == language,
        SDK.is_deprecated == False,
        SDK.is_stable == True
    ).order_by(SDK.created_at.desc()).first()
    
    if not sdk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No stable SDK found for language: {language}"
        )
    
    return sdk
