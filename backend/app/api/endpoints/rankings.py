import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Item
from app.services.supplier_ranking import (
    get_preferred_suppliers,
    get_sourcing_suggestions,
    export_supplier_rankings_csv
)

router = APIRouter()

def parse_query_date(date_str: Optional[str]) -> datetime.date:
    if not date_str:
        return datetime.date.today()
    try:
        return datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return datetime.date.today()

@router.get("")
def get_rankings(
    item_code: Optional[str] = Query(None),
    as_of_date: Optional[str] = Query(None),
    top_n: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    target_date = parse_query_date(as_of_date)
    
    if item_code:
        item = db.query(Item).filter_by(item_code=item_code).first()
        results = get_preferred_suppliers(db, item_code, target_date, top_n=top_n)
        return {
            "item_code": item_code,
            "item_description": item.description if item else None,
            "as_of_date": str(target_date),
            "rankings": results
        }
        
    items = db.query(Item).order_by(Item.item_code).all()
    all_res = []
    for item in items:
        ranked = get_preferred_suppliers(db, item.item_code, target_date, top_n=top_n or 3)
        all_res.append({
            "item_code": item.item_code,
            "item_description": item.description,
            "category": item.category,
            "rankings": ranked
        })
    return {
        "as_of_date": str(target_date),
        "items": all_res
    }

@router.get("/export")
def export_rankings(
    as_of_date: Optional[str] = Query(None),
    top_n: int = Query(3),
    db: Session = Depends(get_db)
):
    target_date = parse_query_date(as_of_date)
    csv_content = export_supplier_rankings_csv(db, target_date, top_n=top_n)
    filename = f"supplier_rankings_{target_date}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/suggestions")
def get_suggestions(
    item_code: str = Query(...),
    count: int = Query(3),
    as_of_date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    target_date = parse_query_date(as_of_date)
    suggestions = get_sourcing_suggestions(db, item_code, target_date, count)
    return {
        "item_code": item_code,
        "as_of_date": str(target_date),
        "count_needed": count,
        "suggested_supplier_ids": suggestions
    }
