import type { FreelancerProject } from "./client";

export type OperatorDecision = "BID" | "MAYBE" | "LEAVE_IT";

export type ProjectScore = {
  decision: OperatorDecision;
  score: number;
  reasons: string[];
  suggestedAmount?: number;
  suggestedDays?: number;
};

/**
 * Conservative first-pass scoring. This is intentionally deterministic so an
 * LLM can enrich the analysis later without being allowed to bypass the guardrails.
 */
export function scoreProject(project: FreelancerProject): ProjectScore {
  const title = (project.title ?? "").toLowerCase();
  const description = (project.description ?? "").toLowerCase();
  const text = `${title} ${description}`;
  let score = 50;
  const reasons: string[] = [];

  const strongTerms = [
    "excel", "python", "automation", "ai", "website", "web app", "react",
    "next.js", "javascript", "typescript", "api", "data processing", "dashboard",
    "shopify", "wordpress", "figma", "ui ux",
  ];
  const weakTerms = [
    "captcha", "adult", "gambling", "crypto recovery", "account recovery",
    "password", "guaranteed profit", "pay outside", "whatsapp only",
  ];

  for (const term of strongTerms) {
    if (text.includes(term)) {
      score += 4;
      reasons.push(`Relevant capability: ${term}`);
    }
  }

  for (const term of weakTerms) {
    if (text.includes(term)) {
      score -= 20;
      reasons.push(`Risk signal: ${term}`);
    }
  }

  const bidCount = project.bid_stats?.bid_count ?? 0;
  if (bidCount <= 5) {
    score += 12;
    reasons.push("Low visible competition");
  } else if (bidCount <= 15) {
    score += 5;
    reasons.push("Moderate competition");
  } else if (bidCount >= 40) {
    score -= 12;
    reasons.push("High competition");
  }

  const minimum = project.budget?.minimum;
  const maximum = project.budget?.maximum;
  if (maximum !== undefined && maximum > 0) {
    if (maximum < 10) {
      score -= 15;
      reasons.push("Budget appears too low for meaningful delivery");
    } else if (maximum >= 100) {
      score += 4;
      reasons.push("Budget supports a substantive deliverable");
    }
  }

  score = Math.max(0, Math.min(100, score));
  const decision: OperatorDecision = score >= 72 ? "BID" : score >= 58 ? "MAYBE" : "LEAVE_IT";

  return {
    decision,
    score,
    reasons: [...new Set(reasons)].slice(0, 8),
    suggestedAmount: maximum ?? minimum,
    suggestedDays: 3,
  };
}
