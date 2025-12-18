from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta

from ..database import get_db
from ..models.developer import Developer
from ..schemas.developer import (
    DeveloperCreate, DeveloperResponse, DeveloperUpdate, Token
)
from ..utils.security import (
    get_password_hash, verify_password, create_access_token,
    get_current_developer, ACCESS_TOKEN_EXPIRE_MINUTES
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=DeveloperResponse, status_code=status.HTTP_201_CREATED)
def register_developer(developer: DeveloperCreate, db: Session = Depends(get_db)):
    existing_email = db.query(Developer).filter(Developer.email == developer.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    existing_username = db.query(Developer).filter(Developer.username == developer.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    hashed_password = get_password_hash(developer.password)
    db_developer = Developer(
        email=developer.email,
        username=developer.username,
        company_name=developer.company_name,
        hashed_password=hashed_password
    )
    db.add(db_developer)
    db.commit()
    db.refresh(db_developer)
    return db_developer


@router.post("/login", response_model=Token)
def login(email: str, password: str, db: Session = Depends(get_db)):
    developer = db.query(Developer).filter(Developer.email == email).first()
    if not developer or not verify_password(password, developer.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not developer.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Developer account is deactivated"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": developer.id}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=DeveloperResponse)
def get_current_developer_info(current_developer: Developer = Depends(get_current_developer)):
    return current_developer


@router.put("/me", response_model=DeveloperResponse)
def update_current_developer(
    developer_update: DeveloperUpdate,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    update_data = developer_update.model_dump(exclude_unset=True)
    
    if "email" in update_data:
        existing = db.query(Developer).filter(
            Developer.email == update_data["email"],
            Developer.id != current_developer.id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
    
    if "username" in update_data:
        existing = db.query(Developer).filter(
            Developer.username == update_data["username"],
            Developer.id != current_developer.id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
    
    for field, value in update_data.items():
        setattr(current_developer, field, value)
    
    db.commit()
    db.refresh(current_developer)
    return current_developer
