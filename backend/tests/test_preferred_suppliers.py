import datetime
import pytest
from app.controllers.ranking_controller import RankingController

def test_preferred_supplier_ranking_weights_and_order(db_session):
    controller = RankingController(db_session)
    as_of = datetime.date(2026, 11, 1)
    
    # ITM-1048: Nitrile coated gloves - Official Worked Example
    res_1048 = controller.get_preferred_suppliers("ITM-1048", as_of, top_n=3)
    assert len(res_1048) >= 2
    assert res_1048[0]["supplier_id"] == "S029"
    assert res_1048[1]["supplier_id"] == "S030"
    
    # ITM-1036: Pneumatic cylinder 50x100 - Official Worked Example
    res_1036 = controller.get_preferred_suppliers("ITM-1036", as_of, top_n=3)
    assert len(res_1036) >= 2
    assert res_1036[0]["supplier_id"] == "S023"
    assert res_1036[1]["supplier_id"] == "S022"
    
    # Verify weights calculation is strictly normalized between 0.0 and 1.0
    for s in res_1048:
        assert 0.0 <= s["score"] <= 1.0
        b = s["breakdown"]
        assert 0.0 <= b["recency_factor"] <= 1.0
        assert 0.0 <= b["on_time_pct"] <= 100.0
        assert 0.0 <= b["quality_rating"] <= 5.0

def test_sourcing_suggestions_category_fallback(db_session):
    controller = RankingController(db_session)
    as_of = datetime.date(2026, 11, 1)
    
    # Request 5 suggestions for an item
    sugg_ids = controller.get_sourcing_suggestions("ITM-1001", as_of, count_needed=5)
    assert isinstance(sugg_ids, list)
    assert len(sugg_ids) > 0
    for sid in sugg_ids:
        assert sid.startswith("S")
