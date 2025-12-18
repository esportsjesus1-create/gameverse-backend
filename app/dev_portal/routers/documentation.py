from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..models.developer import Developer, APIDocumentation, APIEndpoint
from ..schemas.developer import (
    APIDocumentationCreate, APIDocumentationResponse, APIDocumentationUpdate,
    APIEndpointCreate, APIEndpointResponse, APIEndpointUpdate
)
from ..utils.security import get_current_developer

router = APIRouter(prefix="/documentation", tags=["API Documentation"])


@router.get("/", response_model=List[APIDocumentationResponse])
def list_documentation(
    category: Optional[str] = None,
    version: Optional[str] = None,
    published_only: bool = True,
    db: Session = Depends(get_db)
):
    query = db.query(APIDocumentation)
    
    if category:
        query = query.filter(APIDocumentation.category == category)
    
    if version:
        query = query.filter(APIDocumentation.version == version)
    
    if published_only:
        query = query.filter(APIDocumentation.is_published == True)
    
    docs = query.order_by(APIDocumentation.category, APIDocumentation.order_index).all()
    return docs


@router.get("/categories")
def get_documentation_categories(db: Session = Depends(get_db)):
    categories = db.query(APIDocumentation.category).distinct().all()
    return {
        "categories": [cat[0] for cat in categories],
        "default_categories": [
            "Getting Started",
            "Authentication",
            "Games",
            "Players",
            "Matches",
            "Leaderboards",
            "Achievements",
            "Analytics",
            "Webhooks",
            "SDKs",
            "Rate Limiting",
            "Error Handling"
        ]
    }


@router.get("/search")
def search_documentation(
    q: str = Query(..., min_length=2),
    db: Session = Depends(get_db)
):
    docs = db.query(APIDocumentation).filter(
        APIDocumentation.is_published == True,
        (APIDocumentation.title.ilike(f"%{q}%")) |
        (APIDocumentation.content.ilike(f"%{q}%"))
    ).all()
    
    endpoints = db.query(APIEndpoint).filter(
        (APIEndpoint.summary.ilike(f"%{q}%")) |
        (APIEndpoint.description.ilike(f"%{q}%")) |
        (APIEndpoint.path.ilike(f"%{q}%"))
    ).all()
    
    return {
        "documentation": [
            {
                "id": doc.id,
                "title": doc.title,
                "slug": doc.slug,
                "category": doc.category
            }
            for doc in docs
        ],
        "endpoints": [
            {
                "id": ep.id,
                "method": ep.method,
                "path": ep.path,
                "summary": ep.summary
            }
            for ep in endpoints
        ]
    }


@router.get("/{doc_id}", response_model=APIDocumentationResponse)
def get_documentation(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(APIDocumentation).filter(APIDocumentation.id == doc_id).first()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documentation not found"
        )
    
    return doc


@router.get("/slug/{slug}", response_model=APIDocumentationResponse)
def get_documentation_by_slug(slug: str, db: Session = Depends(get_db)):
    doc = db.query(APIDocumentation).filter(APIDocumentation.slug == slug).first()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documentation not found"
        )
    
    return doc


@router.post("/", response_model=APIDocumentationResponse, status_code=status.HTTP_201_CREATED)
def create_documentation(
    doc_data: APIDocumentationCreate,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    if current_developer.tier.value not in ["pro", "enterprise"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Pro and Enterprise tier developers can create documentation"
        )
    
    existing = db.query(APIDocumentation).filter(
        APIDocumentation.slug == doc_data.slug
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Documentation with this slug already exists"
        )
    
    db_doc = APIDocumentation(
        title=doc_data.title,
        slug=doc_data.slug,
        category=doc_data.category,
        content=doc_data.content,
        version=doc_data.version,
        is_published=doc_data.is_published,
        order_index=doc_data.order_index
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    
    return db_doc


@router.put("/{doc_id}", response_model=APIDocumentationResponse)
def update_documentation(
    doc_id: int,
    doc_update: APIDocumentationUpdate,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    if current_developer.tier.value not in ["pro", "enterprise"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Pro and Enterprise tier developers can update documentation"
        )
    
    doc = db.query(APIDocumentation).filter(APIDocumentation.id == doc_id).first()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documentation not found"
        )
    
    update_data = doc_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(doc, field, value)
    
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_documentation(
    doc_id: int,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    if current_developer.tier.value != "enterprise":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Enterprise tier developers can delete documentation"
        )
    
    doc = db.query(APIDocumentation).filter(APIDocumentation.id == doc_id).first()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documentation not found"
        )
    
    db.delete(doc)
    db.commit()
    return None


@router.get("/{doc_id}/endpoints", response_model=List[APIEndpointResponse])
def get_documentation_endpoints(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(APIDocumentation).filter(APIDocumentation.id == doc_id).first()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documentation not found"
        )
    
    endpoints = db.query(APIEndpoint).filter(
        APIEndpoint.documentation_id == doc_id
    ).order_by(APIEndpoint.path, APIEndpoint.method).all()
    
    return endpoints


@router.post("/endpoints", response_model=APIEndpointResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    endpoint_data: APIEndpointCreate,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    if current_developer.tier.value not in ["pro", "enterprise"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Pro and Enterprise tier developers can create endpoint documentation"
        )
    
    doc = db.query(APIDocumentation).filter(
        APIDocumentation.id == endpoint_data.documentation_id
    ).first()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documentation not found"
        )
    
    db_endpoint = APIEndpoint(
        documentation_id=endpoint_data.documentation_id,
        method=endpoint_data.method.upper(),
        path=endpoint_data.path,
        summary=endpoint_data.summary,
        description=endpoint_data.description,
        request_body_schema=endpoint_data.request_body_schema,
        response_schema=endpoint_data.response_schema,
        parameters=endpoint_data.parameters,
        example_request=endpoint_data.example_request,
        example_response=endpoint_data.example_response,
        requires_auth=endpoint_data.requires_auth,
        rate_limit_info=endpoint_data.rate_limit_info
    )
    db.add(db_endpoint)
    db.commit()
    db.refresh(db_endpoint)
    
    return db_endpoint


@router.get("/endpoints/{endpoint_id}", response_model=APIEndpointResponse)
def get_endpoint(endpoint_id: int, db: Session = Depends(get_db)):
    endpoint = db.query(APIEndpoint).filter(APIEndpoint.id == endpoint_id).first()
    
    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Endpoint not found"
        )
    
    return endpoint


@router.put("/endpoints/{endpoint_id}", response_model=APIEndpointResponse)
def update_endpoint(
    endpoint_id: int,
    endpoint_update: APIEndpointUpdate,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    if current_developer.tier.value not in ["pro", "enterprise"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Pro and Enterprise tier developers can update endpoint documentation"
        )
    
    endpoint = db.query(APIEndpoint).filter(APIEndpoint.id == endpoint_id).first()
    
    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Endpoint not found"
        )
    
    update_data = endpoint_update.model_dump(exclude_unset=True)
    if "method" in update_data:
        update_data["method"] = update_data["method"].upper()
    
    for field, value in update_data.items():
        setattr(endpoint, field, value)
    
    db.commit()
    db.refresh(endpoint)
    return endpoint


@router.delete("/endpoints/{endpoint_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(
    endpoint_id: int,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    if current_developer.tier.value != "enterprise":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Enterprise tier developers can delete endpoint documentation"
        )
    
    endpoint = db.query(APIEndpoint).filter(APIEndpoint.id == endpoint_id).first()
    
    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Endpoint not found"
        )
    
    db.delete(endpoint)
    db.commit()
    return None
