import { AgentCoaching, QaResultData } from '../types';

function cleanLines(value: unknown, max = 180): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item).replace(/\s+/g, ' ').trim())
    .filter((item) => item.length > 8 && item.length <= max)
    .slice(0, 4);
}

function isInstruction(text: string) {
  return /^(check|evaluate|determine|for every|assess|return its status|do not treat)/i.test(text) || text.length > 160;
}

function spokenLine(item: string) {
  const text = item.toLowerCase();
  if (text.includes('willing') || text.includes('explore') || text.includes('interest')) {
    return 'Say: “Would you be open to taking a look at this, or is now not the right time?” Then wait for their answer.';
  }
  if (text.includes('consent') || text.includes('follow') || text.includes('contact')) {
    return 'Say: “Is it alright if someone from our team follows up with you?” Then wait for a yes before you book it.';
  }
  if (text.includes('budget')) {
    return 'Say: “Do you already have budget set aside for this, or is that still being decided?” Then let them answer.';
  }
  if (text.includes('timeline') || text.includes('decision')) {
    return 'Say: “When are you hoping to make a decision on this?” Then stop and listen.';
  }
  return `Say: “Before I let you go, can we confirm ${item.charAt(0).toLowerCase()}${item.slice(1)}?” Then wait for a yes or no.`;
}

export function coachingFromScore(qa: QaResultData | undefined): AgentCoaching | null {
  if (!qa) return null;
  const stored = qa.agentCoaching;
  const storedAvoid = cleanLines(stored?.avoid, 280);
  const storedSay = cleanLines(stored?.sayInstead, 280);
  const storedImprove = cleanLines(stored?.improve, 280);
  if (stored?.summary && (storedAvoid.length || storedSay.length || storedImprove.length)) {
    return {
      summary: stored.summary,
      avoid: storedAvoid,
      sayInstead: storedSay,
      improve: storedImprove,
    };
  }

  const reasons = cleanLines(qa.reviewReasons, 240);
  const missing = cleanLines(qa.missingRequirements, 160).filter((item) => !isInstruction(item));
  const kept = (qa.checklist || [])
    .filter((item) => item.isMet && item.evidence && !isInstruction(item.requirement) && item.evidence.length < 160)
    .slice(0, 2);
  if (!reasons.length && !missing.length && !kept.length) return null;

  return {
    summary:
      reasons[0] ||
      `This call scored ${qa.overallScore}%. ${missing.length || 'Some'} point${missing.length === 1 ? '' : 's'} still need a direct answer from the prospect.`,
    avoid: reasons.length
      ? reasons
      : missing.map((item) => `Do not end the call before the prospect answers: ${item}.`),
    sayInstead: missing.map((item) => spokenLine(item)),
    improve: [
      ...missing.slice(0, 3).map((item) => `On the next call, get a clear answer on ${item.toLowerCase()} before you book a follow-up.`),
      ...kept.map((item) => `Keep this. It already landed: “${item.evidence}”.`),
    ].slice(0, 4),
  };
}
