import json
from typing import List, Dict

def generate_behavioral_summary(candidate_name: str, logs: List[Dict]) -> str:
    """
    Generates a professional behavioral summary based on proctoring & emotional logs.
    """
    if not logs:
        return f"Candidate {candidate_name} demonstrated exceptional integrity. No violations or suspicious behaviors were detected. High confidence in session validity."

    violation_counts = {}
    emotions = []
    total_stress = 0
    stress_checkpoints = 0
    integrity_score = 100 # Baseline

    for log in logs:
        v_type = log.get("type", "UNKNOWN")
        
        if v_type == "BEHAVIORAL_SNAPSHOT" and log.get("details"):
            try:
                details = json.loads(log["details"])
                emotions.append(details.get("emotion"))
                total_stress += details.get("stress", 0)
                integrity_score += details.get("integrity_impact", 0)
                stress_checkpoints += 1
            except:
                continue
        else:
            v_name = v_type.replace("_", " ").title()
            violation_counts[v_name] = violation_counts.get(v_name, 0) + 1
            # Adjust integrity for hard violations
            if v_type in ["PHONE_DETECTED", "MULTIPLE_FACES"]: integrity_score -= 40
            elif v_type in ["LOOKING_AWAY", "TAB_SWITCH"]: integrity_score -= 10

    total_violations = sum(v for k, v in violation_counts.items())
    avg_stress = total_stress / max(1, stress_checkpoints)
    dominant_emotion = max(set(emotions), key=emotions.count) if emotions else "Neutral"

    # Analysis logic
    if integrity_score < 40 or "Phone Detected" in violation_counts:
        status = "CRITICAL RISK"
        summary = f"Neural audit for {candidate_name} indicates highly suspicious patterns. "
    elif integrity_score < 75 or total_violations > 5:
        status = "MEDIUM RISK"
        summary = f"Candidate {candidate_name} displayed several behavioral deviations. "
    else:
        status = "LOW RISK"
        summary = f"Candidate {candidate_name} maintained a professional profile with minor anomalies. "

    summary += f"The dominant emotional state was '{dominant_emotion}' with an average stress index of {avg_stress:.1f}%. "
    
    if "Phone Detected" in violation_counts:
        summary += "Unauthorized device usage was confirmed. "
    
    if "Surprised" in emotions and "Looking Away" in violation_counts:
        summary += "Frequent 'Surprise' responses during gaze deviation suggest external assistance. "
    
    if avg_stress > 70:
        summary += "Sustained high stress levels may indicate significant test anxiety or non-compliance. "

    summary += f"Final Integrity Score: {max(0, min(100, integrity_score))}/100. Decision: {status}."
    
    return summary
