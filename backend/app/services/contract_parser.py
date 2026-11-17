import re
import os
from typing import Dict, Any, List
import pymupdf

def extract_contract_from_pdf(pdf_path: str) -> Dict[str, Any]:
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")
        
    doc = pymupdf.open(pdf_path)
    text = "\n".join([page.get_text() for page in doc])
    
    # Contract No
    c_match = re.search(r"Contract\s+(?:No\.?|Number)\s*[:.]?\s*([A-Z0-9-]+)", text, re.IGNORECASE)
    contract_id = c_match.group(1).strip() if c_match else os.path.basename(pdf_path).replace(".pdf", "")
    
    # Supplier
    s_match = re.search(
        r"between\s+Corvo\s+Engineering\s+Pvt\s+Ltd.*?and\s+([^,(]+).*?\(Supplier\s+ID\s+([A-Z0-9]+)\)",
        text,
        re.DOTALL | re.IGNORECASE
    )
    supplier_name = s_match.group(1).strip() if s_match else "Unknown Supplier"
    supplier_id = s_match.group(2).strip() if s_match else None
    
    # Term
    term_match = re.search(
        r"valid\s+from\s+(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})",
        text,
        re.IGNORECASE
    )
    start_date = term_match.group(1) if term_match else None
    end_date = term_match.group(2) if term_match else None
    
    # Value ceiling
    cap_match = re.search(r"exceed\s+(?:INR|Rs\.?)\s*([\d,]+)", text, re.IGNORECASE)
    value_cap = float(cap_match.group(1).replace(",", "")) if cap_match else 0.0
    
    # Schedule A: Items and rates
    lines: List[Dict[str, Any]] = []
    line_pattern = re.compile(
        r"^\s*\d+\s+(ITM-\d+)\s+(.+?)\s+([A-Za-z]+)\s+([\d,]+(?:\.\d+)?)\s*$",
        re.MULTILINE
    )
    for m in line_pattern.finditer(text):
        lines.append({
            "item_code": m.group(1).strip(),
            "description": m.group(2).strip(),
            "uom": m.group(3).strip(),
            "rate": float(m.group(4).replace(",", ""))
        })
        
    return {
        "contract_id": contract_id,
        "supplier_id": supplier_id,
        "supplier_name": supplier_name,
        "start_date": start_date,
        "end_date": end_date,
        "value_cap": value_cap,
        "consumed_value": 0.0,
        "source_type": "PDF",
        "document_path": pdf_path,
        "lines": lines
    }
