import json
import os
import re
from typing import Dict, Any, Optional, List
from app.core.config import settings

class AIStore:
    """
    Central AI Store for all LLM/GenAI tasks.
    Configured to use Google Gemini only via settings.GEMINI_MODEL.
    Easily adaptable for model updates and provides robust fallbacks.
    """
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL
        self._client = None
        if self.api_key:
            try:
                from google import genai
                self._client = genai.Client(
                    api_key=self.api_key,
                    http_options={"api_version": "v1beta"}
                )
            except Exception as e:
                print(f"Warning: Failed to initialize google-genai client: {e}")

    def call_gemini(self, prompt: str, system_instruction: Optional[str] = None) -> Optional[str]:
        if not self._client:
            return None
        try:
            from google.genai import types
            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.1,
                response_mime_type="application/json"
            )
            response = self._client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=config
            )
            return response.text
        except Exception as e:
            print(f"Gemini API call failed with {self.model_name}: {e}. Retrying without mime_type...")
            try:
                from google.genai import types
                config = types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.1
                )
                response = self._client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config=config
                )
                return response.text
            except Exception as e2:
                print(f"Gemini retry failed: {e2}")
                return None

    def extract_pr_from_chat(self, user_message: str, history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
        """
        Extracts PR details from natural language chat into structured JSON.
        Fields: item_description, quantity, plant, need_by_date, urgency, estimated_unit_price
        """
        history_context = ""
        if history:
            history_context = "Conversation history:\n" + "\n".join([f"{h.get('role', 'user')}: {h.get('content', '')}" for h in history]) + "\n"

        prompt = f"""
{history_context}
You are an intelligent procurement intake assistant for Corvo Engineering.
Analyze the user's message to extract purchase requisition details.
Plants available in Corvo:
- PUN1 (Bhosari, Pune)
- CHK1 (Chakan)

Extract the information into strict JSON with these exact keys:
{{
    "item_description": "<clear item description extracted from message or null>",
    "quantity": <number or null>,
    "uom": "<NOS, KG, LTR, PAIR, MTR, BKT, SET, JOB or null>",
    "plant": "<PUN1 or CHK1 or null>",
    "need_by_date": "<YYYY-MM-DD or null; calculate date if relative e.g. next Friday>",
    "urgency": "<Normal or Emergency>",
    "estimated_unit_price": <number or null>,
    "is_complete": <boolean, true ONLY if item_description, quantity, plant, and need_by_date are all present and valid>,
    "missing_fields": ["<list of missing required fields among item_description, quantity, plant, need_by_date>"],
    "assistant_reply": "<Polite, helpful message confirming what was understood and asking for missing fields if any>"
}}

User message: "{user_message}"
"""
        system_instruction = "You are a procurement data extraction assistant that extracts structured PR fields into JSON."
        response_text = self.call_gemini(prompt, system_instruction=system_instruction)
        if response_text:
            try:
                clean = re.sub(r"```json\s*", "", response_text)
                clean = re.sub(r"```\s*", "", clean).strip()
                data = json.loads(clean)
                return data
            except Exception as e:
                print(f"Error parsing Gemini JSON: {e}")

        # Deterministic fallback parser
        return self._fallback_chat_extraction(user_message)

    def _fallback_chat_extraction(self, text: str) -> Dict[str, Any]:
        t = text.lower()
        
        # Quantity
        qty = None
        qty_match = re.search(r'\b(\d+(?:\.\d+)?)\s*(nos|kg|ltr|pair|mtr|bkt|set|job|bottles?|boxes?|packs?|pieces?|units?)?\b', t)
        uom = "NOS"
        if qty_match:
            try:
                qty = float(qty_match.group(1))
                if qty_match.group(2):
                    u = qty_match.group(2).upper()
                    if "PAIR" in u: uom = "PAIR"
                    elif "KG" in u: uom = "KG"
                    elif "LTR" in u: uom = "LTR"
                    elif "MTR" in u: uom = "MTR"
            except ValueError:
                pass

        # Plant
        plant = None
        if "chakan" in t or "chk1" in t or "chk" in t:
            plant = "CHK1"
        elif "bhosari" in t or "pun1" in t or "pune" in t:
            plant = "PUN1"

        # Urgency
        urgency = "Emergency" if ("emergency" in t or "urgent" in t or "asap" in t) else "Normal"

        # Need by date
        need_by = None
        import datetime
        from dateutil.relativedelta import relativedelta, FR, MO
        today = datetime.date.today()
        if "next friday" in t:
            need_by = str(today + relativedelta(weekday=FR(+2)))
        elif "friday" in t:
            need_by = str(today + relativedelta(weekday=FR(+1)))
        elif "next monday" in t:
            need_by = str(today + relativedelta(weekday=MO(+2)))
        elif "tomorrow" in t:
            need_by = str(today + datetime.timedelta(days=1))
        else:
            date_match = re.search(r'\b(\d{4}-\d{2}-\d{2})\b', t)
            if date_match:
                need_by = date_match.group(1)
            else:
                need_by = str(today + datetime.timedelta(days=7))

        desc = text
        # Strip dates
        desc = re.sub(r'\b\d{4}-\d{2}-\d{2}\b', '', desc)
        desc = re.sub(r'\b(need|require|please order|urgent|urgently|emergency|for|by|next|friday|monday|tomorrow|chakan|bhosari|pune|chk1|pun1|plant|nos|pair|kg|ltr|mtr|rol|set)\b', '', desc, flags=re.IGNORECASE)
        if qty:
            desc = re.sub(rf'\b{int(qty) if qty.is_integer() else qty}\b', '', desc)
        desc = re.sub(r'\s+', ' ', desc).strip()
        if not desc:
            desc = "Requested item"

        missing = []
        if not desc or desc == "Requested item": missing.append("item_description")
        if not qty: missing.append("quantity")
        if not plant: missing.append("plant")
        if not need_by: missing.append("need_by_date")

        is_complete = (len(missing) == 0)
        
        reply = ""
        if is_complete:
            reply = f"I've prepared your purchase request for {qty} {uom} of '{desc}' for plant {plant}, needed by {need_by} ({urgency} priority). Would you like to confirm and create this PR?"
        else:
            reply = f"I noted your request for '{desc}'. To complete the purchase request, please provide: {', '.join(missing)}."

        return {
            "item_description": desc,
            "quantity": qty,
            "uom": uom,
            "plant": plant,
            "need_by_date": need_by,
            "urgency": urgency,
            "estimated_unit_price": None,
            "is_complete": is_complete,
            "missing_fields": missing,
            "assistant_reply": reply
        }

    def parse_policy_amendment(self, document_text: str, current_policy_config: Dict[str, Any]) -> Dict[str, Any]:
        prompt = f"""
You are a procurement policy legal and business analyst for Corvo Engineering.
Analyze this procurement policy amendment against the current Procurement Policy v5.0 configuration.

Current policy configuration:
{json.dumps(current_policy_config, indent=2)}

Amendment text:
\"\"\"
{document_text}
\"\"\"

Output strict JSON:
{{
    "new_version": "e.g. 5.1 or 6.0",
    "effective_date": "YYYY-MM-DD",
    "document_id": "CORVO-PROC-POL-04",
    "change_summary": "High-level summary of the amendment",
    "plain_language_preview": "Clear bullet points explaining what will change for employees and buyers",
    "modified_rules": [
        {{
            "rule_number": "e.g. 5.4",
            "rule_name": "Spot PO",
            "field": "threshold",
            "old_value": 200000,
            "new_value": 300000,
            "explanation": "Spot PO limit increased from 2L to 3L"
        }}
    ],
    "updated_rules_config": {{
        // Complete updated JSON configuration matching current_policy_config schema with new thresholds or rules applied
    }}
}}
"""
        system_instruction = "You are a legal procurement policy analyzer. Output strictly valid JSON."
        response_text = self.call_gemini(prompt, system_instruction=system_instruction)
        if response_text:
            try:
                clean = re.sub(r"```json\s*", "", response_text)
                clean = re.sub(r"```\s*", "", clean).strip()
                return json.loads(clean)
            except Exception as e:
                print(f"Error parsing Gemini policy amendment JSON: {e}")

        return self._fallback_amendment_parser(document_text, current_policy_config)

    def _fallback_amendment_parser(self, text: str, current_config: Dict[str, Any]) -> Dict[str, Any]:
        new_config = json.loads(json.dumps(current_config))
        v_match = re.search(r"version\s*(\d+(?:\.\d+)?)", text, re.IGNORECASE)
        new_ver = v_match.group(1) if v_match else "5.1"
        new_config["version"] = new_ver
        
        d_match = re.search(r"effective\s+(?:date\s*[:.]?\s*)?(\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]+\s+\d{4})", text, re.IGNORECASE)
        eff_date = "2026-12-01"
        if d_match:
            try:
                from dateutil.parser import parse
                eff_date = str(parse(d_match.group(1)).date())
            except Exception:
                pass
        new_config["effective_date"] = eff_date

        changes = []
        spot_match = re.search(r"spot\s+po\s+(?:limit|threshold|value)\s*(?:is\s+raised\s+to|increased\s+to|to)\s*(?:inr|rs\.?)?\s*([\d,]+)", text, re.IGNORECASE)
        if spot_match:
            new_val = float(spot_match.group(1).replace(",", ""))
            for r in new_config.get("rules", []):
                if r.get("outcome_route") == "SPOT_PO":
                    old_val = r["condition_params"].get("max_value", 200000.0)
                    r["condition_params"]["max_value"] = new_val
                    changes.append(f"Spot PO limit increased from ₹{old_val:,.0f} to ₹{new_val:,.0f}")

        emerg_match = re.search(r"emergency\s+(?:po\s+)?(?:limit|threshold|value)\s*(?:is\s+raised\s+to|increased\s+to|to)\s*(?:inr|rs\.?)?\s*([\d,]+)", text, re.IGNORECASE)
        if emerg_match:
            new_val = float(emerg_match.group(1).replace(",", ""))
            for r in new_config.get("rules", []):
                if r.get("outcome_route") == "EMERGENCY_PO":
                    old_val = r["condition_params"].get("max_value", 500000.0)
                    r["condition_params"]["max_value"] = new_val
                    changes.append(f"Emergency PO limit changed from ₹{old_val:,.0f} to ₹{new_val:,.0f}")

        rfq_match = re.search(r"rfq\s+(?:limit|threshold|value)\s*(?:is\s+raised\s+to|increased\s+to|to)\s*(?:inr|rs\.?)?\s*([\d,]+)", text, re.IGNORECASE)
        if rfq_match:
            new_val = float(rfq_match.group(1).replace(",", ""))
            for r in new_config.get("rules", []):
                if r.get("outcome_route") == "RFQ":
                    old_val = r["condition_params"].get("max_value", 1000000.0)
                    r["condition_params"]["max_value"] = new_val
                    changes.append(f"RFQ threshold changed from ₹{old_val:,.0f} to ₹{new_val:,.0f}")
                elif r.get("outcome_route") == "RFP":
                    r["condition_params"]["min_value"] = new_val

        if not changes:
            changes.append("Policy amendment recorded with updated effective date and parameters.")

        return {
            "new_version": new_ver,
            "effective_date": eff_date,
            "document_id": current_config.get("document_id", "CORVO-PROC-POL-04"),
            "change_summary": f"Policy updated to version {new_ver} effective {eff_date}.",
            "plain_language_preview": "\n".join(f"• {c}" for c in changes),
            "modified_rules": changes,
            "updated_rules_config": new_config
        }

ai_store = AIStore()
