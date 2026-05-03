from main_pipeline import run_pipeline

test_inputs = [
    "อยากหน้าเรียว",
    "Botox ดีไหม",
    "มีโปรไหม",
    "อันไหนดีกว่า filler"
]

for text in test_inputs:
    print("="*50)
    print("INPUT:", text)
    print(run_pipeline(text))
