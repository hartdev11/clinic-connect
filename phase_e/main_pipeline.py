import yaml
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from intent_router import IntentRouter
from conversation_state_manager import ConversationStateManager
from brain_selector import BrainSelector
from context_loader import ContextLoader
from recommendation_engine import RecommendationEngine
from scoring_engine import ScoringEngine
from response_generator import ResponseGenerator
from cta_engine import CTAEngine
from media_selector import MediaSelector
from ai_logger import AILogger

# Load config
with open("config.yaml") as f:
    config = yaml.safe_load(f)

# Init all engines
intent_router = IntentRouter()
state_manager = ConversationStateManager()
brain_selector = BrainSelector()
context_loader = ContextLoader(config.get("dataset_path", "./dataset"))
recommendation_engine = RecommendationEngine(context_loader)
scoring_engine = ScoringEngine(context_loader)
response_generator = ResponseGenerator(context_loader)
cta_engine = CTAEngine(context_loader)
media_selector = MediaSelector(config.get("dataset_path", "./dataset"))
ai_logger = AILogger(config.get("log_path", "./logs"))


def run_pipeline(user_input: str, user_id: str = "default_user") -> dict:

    # STEP 1: Intent Router
    intent_data = intent_router.route(user_input)

    # STEP 2: Conversation State
    state_manager.update_intent(user_id, intent_data["primary_intent"])
    state = state_manager.get_state(user_id)

    # STEP 3: Brain Selector
    brain_data = brain_selector.select_brain(intent_data, state)

    # STEP 4: Recommendation
    recommended_ids = recommendation_engine.recommend(intent_data, state, user_input)

    # STEP 5: Scoring
    ranked = scoring_engine.score(recommended_ids, intent_data, state)

    # STEP 6: Context Loader
    context = context_loader.build_context(intent_data, state, recommended_ids)

    # STEP 7: Response Generator
    response_data = response_generator.generate(
        brain_data, intent_data, state, recommended_ids, context
    )

    # STEP 8: CTA Engine
    main_proc = ranked[0]["procedure_id"] if ranked else "proc_001"
    cta_data = cta_engine.generate(intent_data, state, main_proc, context)

    # STEP 9: Media Selector
    media_data = media_selector.select(main_proc, state)

    # STEP 10: Update state
    state_manager.update_recommendations(user_id, recommended_ids)
    state_manager.update_cta(user_id, cta_data.get("cta_text", ""))

    # Build output
    output = {
        "intent": intent_data["primary_intent"],
        "stage": state["conversation_stage"],
        "brain": brain_data["selected_brain"],
        "recommendations": ranked,
        "response": response_data.get("text"),
        "cta": cta_data.get("cta_text"),
        "media": media_data,
        "risk_flag": False
    }

    # STEP 11: Log
    ai_logger.log(user_id, user_input, output)

    return output


if __name__ == "__main__":
    test_inputs = [
        "อยากหน้าเรียว",
        "Botox ดีไหม",
        "มีโปรไหม",
        "filler กับ botox ต่างกันยังไง"
    ]

    for text in test_inputs:
        print("=" * 50)
        print(f"INPUT: {text}")
        result = run_pipeline(text)
        print(f"INTENT: {result['intent']}")
        print(f"STAGE: {result['stage']}")
        print(f"BRAIN: {result['brain']}")
        print(f"RECOMMENDATIONS: {[r['procedure_id'] for r in result['recommendations']]}")
        print(f"RESPONSE: {result['response']}")
        print(f"CTA: {result['cta']}")
