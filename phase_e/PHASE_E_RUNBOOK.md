# PHASE E RUNBOOK

## STEP 0: เตรียม environment
pip install -r requirements.txt
mkdir -p logs

## STEP 1: ทดสอบ pipeline
python3 main_pipeline.py

## STEP 2: run simulation
python3 simulate_users.py

## STEP 3: run analytics
python3 analytics_engine.py

## STEP 4: run optimizer
python3 optimizer.py

## STEP 5: run full evaluation
python3 evaluation_runner.py

## STEP 6: run A/B test
python3 ab_test_manager.py

## STEP 7: run auto learning
python3 auto_trainer.py

## STEP 8: validate
python3 phase_e_full_validator.py
