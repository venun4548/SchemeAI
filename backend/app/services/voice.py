"""Voice command intent engine.

Turns free-form speech into structured intents the backend can fulfil,
and returns a response string the frontend speaks back in the chosen language.
"""
from __future__ import annotations

import re

INTENTS = [
    {"name": "find_schemes", "pattern": re.compile(r"(find|show|list|recommend|which|what).*(scheme|schemes|benefit|yojana|eligible)"),
     "needs": ["recommendations"]},
    {"name": "track_application", "pattern": re.compile(r"(track|status|where is|how is).*(application|application status)"),
     "needs": ["applications"]},
    {"name": "eligibility_explain", "pattern": re.compile(r"why.*(eligible|not eligible|ineligible)|explain.*eligible"),
     "needs": ["explanation"]},
    {"name": "documents", "pattern": re.compile(r"(document|documents|what.*upload|missing document)"),
     "needs": ["documents"]},
    {"name": "deadlines", "pattern": re.compile(r"(deadline|deadlines|due|due date|expiry)"),
     "needs": ["deadlines"]},
    {"name": "notifications", "pattern": re.compile(r"(notification|alerts|updates)"),
     "needs": ["notifications"]},
    {"name": "office", "pattern": re.compile(r"(office|nearby|nearest|csc|centre|center)"),
     "needs": ["offices"]},
    {"name": "help", "pattern": re.compile(r"(help|hi|hello|hey)"),
     "needs": []},
]

WELCOME = {
    "en": "Namaste! I am your SchemeAI assistant. You can ask me things like: Find schemes for women entrepreneurs, or Track my application.",
    "hi": "नमस्ते! मैं आपका SchemeAI सहायक हूँ। आप मुझसे पूछ सकते हैं, जैसे: महिला उद्यमियों के लिए योजनाएं खोजें, या मेरा आवेदन ट्रैक करें।",
    "te": "నమస్తే! నేను మీ SchemeAI సహాయకుడిని. మీరు అడగవచ్చు: మహిళా వ్యాపారవేత్తల కోసం పథకాలు కనుగొనండి, లేదా నా దరఖాస్తును ట్రాక్ చేయండి.",
    "ta": "வணக்கம்! நான் உங்கள் SchemeAI உதவியாளர். நீங்கள் கேட்கலாம்: பெண் தொழில்முனைவோருக்கான திட்டங்களைக் கண்டறியவும், அல்லது எனது விண்ணப்பத்தைக் கண்காணிக்கவும்.",
    "kn": "ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ SchemeAI ಸಹಾಯಕ. ನೀವು ಕೇಳಬಹುದು: ಮಹಿಳಾ ಉದ್ಯಮಿಗಳಿಗೆ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಿ, ಅಥವಾ ನನ್ನ ಅರ್ಜಿಯನ್ನು ಟ್ರ್ಯಾಕ್ ಮಾಡಿ.",
    "mr": "नमस्कार! मी तुमचा SchemeAI सहाय्यक. तुम्ही विचारू शकता: महिला उद्योजकांसाठी योजना शोधा, किंवा माझा अर्ज ट्रॅक करा.",
}


def detect_intent(text: str) -> str:
    for intent in INTENTS:
        if intent["pattern"].search(text.lower()):
            return intent["name"]
    return "help"


def _summary(profile: dict) -> str:
    return (
        f"you are a {profile.get('age', '?')}-year-old "
        f"{profile.get('occupation', 'person')} from {profile.get('state', 'your state')} "
        f"with an annual income of ₹{profile.get('annual_income', 0):,.0f}"
    )


def respond(intent: str, context: dict, language: str = "en") -> str:
    if intent == "find_schemes":
        recs = context.get("recommendations") or []
        if not recs:
            return f"Complete your profile and I will find the best schemes for you. {_summary(context.get('profile') or {})}."
        top = recs[0]
        return (
            f"I found {len(recs)} matching schemes. Best match: {top.get('name', '')} "
            f"with an eligibility score of {top.get('score', 0):.0f} percent. "
            f"Second best is {recs[1].get('name') if len(recs) > 1 else 'none'}."
        )
    if intent == "track_application":
        apps = context.get("applications") or []
        if not apps:
            return "You have no submitted applications yet. Would you like me to recommend some schemes?"
        app = apps[0]
        return (
            f"Your application {app.get('application_id')} for {app.get('scheme_name')} "
            f"is currently {app.get('status', 'unknown').replace('_', ' ')}. "
            f"You are on step {app.get('current_step')} of {len(app.get('steps') or [])}."
        )
    if intent == "eligibility_explain":
        exp = context.get("explanation") or {}
        if exp.get("why_eligible"):
            return f"You are eligible for {exp.get('scheme_name')} because {exp['why_eligible'][0].lower()}."
        return "Share your profile and I will explain your eligibility step by step."
    if intent == "documents":
        status = context.get("document_status") or {}
        missing = status.get("missing") or []
        if missing:
            return f"You are missing these documents: {', '.join(missing)}. Upload them to proceed."
        return "All required documents are uploaded and ready."
    if intent == "deadlines":
        deadlines = context.get("deadlines") or []
        if deadlines:
            return f"You have {len(deadlines)} upcoming deadlines. The nearest is {deadlines[0]}."
        return "No deadlines are coming up for you right now."
    if intent == "notifications":
        count = context.get("unread_count", 0)
        return f"You have {count} unread notifications."
    if intent == "office":
        offices = context.get("offices") or []
        if offices:
            off = offices[0]
            return f"The nearest office is {off.get('name')} in {off.get('district')}, about {off.get('distance_km', '?')} kilometres away."
        return "I could not find nearby offices. Allow location access and try again."
    return WELCOME.get(language, WELCOME["en"])
