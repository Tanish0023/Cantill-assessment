import io
import csv
import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.repositories import (
    SupplierRepository, ItemRepository, POHistoryRepository, ContractRepository
)

class RankingController:
    def __init__(self, db: Session):
        self.db = db
        self.supplier_repo = SupplierRepository(db)
        self.item_repo = ItemRepository(db)
        self.po_repo = POHistoryRepository(db)
        self.contract_repo = ContractRepository(db)

    def get_preferred_suppliers(self, item_code: str, as_of_date: datetime.date, top_n: Optional[int] = None) -> List[Dict[str, Any]]:
        active_suppliers = {s.supplier_id: s for s in self.supplier_repo.get_active()}
        
        # 1. PO history for item in last 548 days
        pos = self.po_repo.get_by_item(item_code, as_of_date, days_window=548)
        supp_pos: Dict[str, list] = {}
        for p in pos:
            if p.supplier_id in active_suppliers:
                supp_pos.setdefault(p.supplier_id, []).append(p)

        # 2. Contracts covering item started on or before as_of_date
        contracts = self.contract_repo.get_contracts_for_item(item_code, as_of_date)
        supp_contracts: Dict[str, list] = {}
        for cl, c in contracts:
            if c.supplier_id in active_suppliers:
                supp_contracts.setdefault(c.supplier_id, []).append((cl, c))

        candidate_ids = set(supp_pos.keys()).union(set(supp_contracts.keys()))
        candidates = []

        for s_id in candidate_ids:
            s = active_suppliers[s_id]
            p_list = supp_pos.get(s_id, [])
            c_list = supp_contracts.get(s_id, [])

            po_count = len(p_list)
            recency = 0.0
            most_recent_po_price = None

            if p_list:
                sorted_pos = sorted(p_list, key=lambda x: x.po_date, reverse=True)
                most_recent_po = sorted_pos[0]
                most_recent_po_price = most_recent_po.unit_price
                days_ago = (as_of_date - most_recent_po.po_date).days
                if days_ago <= 90:
                    recency = 1.0
                elif days_ago <= 365:
                    recency = 0.5
                else:
                    recency = 0.0

            has_contract = len(c_list) > 0
            latest_contract_rate = None
            if c_list:
                sorted_c = sorted(c_list, key=lambda x: x[1].start_date, reverse=True)
                latest_contract_rate = sorted_c[0][0].rate

            # Reference price
            if most_recent_po_price is not None:
                reference_price = most_recent_po_price
            elif latest_contract_rate is not None:
                reference_price = latest_contract_rate
            else:
                item_obj = self.item_repo.get_by_code(item_code)
                reference_price = item_obj.standard_price if item_obj else 0.0

            # Scoring: Frequency (30%), Recency (25%), Contract History (20%), On-Time Delivery (15%), Quality (10%)
            s_freq = min(po_count / 10.0, 1.0)
            s_rec = recency
            s_con = 1.0 if has_contract else 0.0
            s_otd = s.on_time_pct / 100.0
            s_qual = s.quality_rating / 5.0
            score = (0.30 * s_freq) + (0.25 * s_rec) + (0.20 * s_con) + (0.15 * s_otd) + (0.10 * s_qual)

            candidates.append({
                "supplier_id": s_id,
                "supplier_name": s.name,
                "status": s.status,
                "po_count": po_count,
                "recency": recency,
                "has_contract": has_contract,
                "on_time_pct": s.on_time_pct,
                "quality_rating": s.quality_rating,
                "reference_price": round(reference_price, 2),
                "score": round(score, 4),
                "breakdown": {
                    "po_count": po_count,
                    "recency_factor": recency,
                    "contract_held": has_contract,
                    "on_time_pct": s.on_time_pct,
                    "quality_rating": s.quality_rating
                }
            })

        candidates.sort(key=lambda x: (x["score"], x["on_time_pct"], x["quality_rating"]), reverse=True)
        for rank_idx, cand in enumerate(candidates, start=1):
            cand["rank"] = rank_idx

        if top_n is not None:
            return candidates[:top_n]
        return candidates

    def get_sourcing_suggestions(self, item_code: str, as_of_date: datetime.date, count_needed: int) -> List[str]:
        if not item_code or item_code == "NEW":
            return []

        preferred = self.get_preferred_suppliers(item_code, as_of_date)
        suggested = [p["supplier_id"] for p in preferred]

        if len(suggested) >= count_needed:
            return suggested[:count_needed]

        item_obj = self.item_repo.get_by_code(item_code)
        if not item_obj:
            return suggested[:count_needed]

        category = item_obj.category
        active_cat_supps = self.supplier_repo.get_active_by_category(category)
        already_chosen = set(suggested)
        remaining = [s for s in active_cat_supps if s.supplier_id not in already_chosen]

        remaining.sort(
            key=lambda s: ((s.quality_rating / 5.0 * 60.0) + (s.on_time_pct / 100.0 * 40.0)),
            reverse=True
        )

        for s in remaining:
            suggested.append(s.supplier_id)
            if len(suggested) >= count_needed:
                break

        return suggested[:count_needed]

    def export_rankings_csv(self, as_of_date: datetime.date, top_n: int = 3) -> str:
        items = self.item_repo.get_all()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["item_code", "rank", "supplier_id", "reference_price"])

        for item in items:
            ranked = self.get_preferred_suppliers(item.item_code, as_of_date, top_n=top_n)
            for r in ranked:
                writer.writerow([
                    item.item_code,
                    r["rank"],
                    r["supplier_id"],
                    f"{r['reference_price']:.2f}"
                ])
        return output.getvalue()
