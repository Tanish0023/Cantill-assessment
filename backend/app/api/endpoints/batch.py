import io
import csv
import pandas as pd
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.controllers.procurement_controller import ProcurementController
from app.repositories import PolicyRepository

router = APIRouter()

REQUIRED_COLUMNS = [
    "pr_no", "pr_line", "resolved_item_code", "group_id", "po_id",
    "decision", "route", "supplier_id", "unit_price", "group_value_inr",
    "suggested_supplier_ids", "policy_version", "reason"
]

def generate_csv_output(results: List[Dict[str, Any]]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(REQUIRED_COLUMNS)
    for r in results:
        writer.writerow([
            r.get("pr_no", ""),
            r.get("pr_line", ""),
            r.get("resolved_item_code", ""),
            r.get("group_id", ""),
            r.get("po_id", ""),
            r.get("decision", ""),
            r.get("route", ""),
            r.get("supplier_id", ""),
            f"{r['unit_price']:.2f}" if r.get("unit_price") not in ("", None) else "",
            f"{r['group_value_inr']:.2f}" if r.get("group_value_inr") not in ("", None) else "",
            r.get("suggested_supplier_ids", ""),
            r.get("policy_version", ""),
            r.get("reason", "")
        ])
    return output.getvalue()

@router.post("/process-batch")
async def process_batch_endpoint(
    file: Optional[UploadFile] = File(None),
    policy_version: Optional[str] = None,
    export_format: Optional[str] = "json",
    persist: Optional[bool] = False,
    db: Session = Depends(get_db)
):
    if not file:
        raise HTTPException(status_code=400, detail="Please upload a CSV file.")
        
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV format: {e}")

    lines_data = df.to_dict(orient="records")
    controller = ProcurementController(db)
    policy_repo = PolicyRepository(db)
    
    policy_obj = None
    if policy_version:
        policy_obj = policy_repo.get_by_version(policy_version)

    results = controller.process_batch(lines_data, policy_override=policy_obj, persist=persist or False)

    if export_format == "csv":
        csv_str = generate_csv_output(results)
        return Response(
            content=csv_str,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=procurement_decisions.csv"}
        )

    return {
        "total_lines": len(results),
        "results": results
    }

@router.get("/export-sample")
def export_sample_decisions(
    policy_version: Optional[str] = None,
    format: str = "csv",
    persist: bool = True,
    db: Session = Depends(get_db)
):
    import os
    from app.core.config import settings
    sample_csv_path = os.path.join(settings.DATA_DIR, "pr_batches", "sample_pr_batch.csv")
    if not os.path.exists(sample_csv_path):
        raise HTTPException(status_code=404, detail="sample_pr_batch.csv not found")

    df = pd.read_csv(sample_csv_path)
    lines_data = df.to_dict(orient="records")

    controller = ProcurementController(db)
    policy_repo = PolicyRepository(db)

    policy_obj = None
    if policy_version:
        policy_obj = policy_repo.get_by_version(policy_version)

    results = controller.process_batch(lines_data, policy_override=policy_obj, persist=persist)

    if format == "csv":
        csv_str = generate_csv_output(results)
        return Response(
            content=csv_str,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=sample_batch_decisions.csv"}
        )

    return {
        "total_lines": len(results),
        "results": results
    }
