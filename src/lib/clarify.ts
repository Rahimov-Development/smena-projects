import { type Answer, type ClarifyResult, type ClarifySource } from "./brief";
import { nextTurn } from "./interviewer";
import { clarifyWithOpenRouter } from "./openrouter";

export async function clarifyBrief(
  brief: string,
  answers: Answer[],
): Promise<ClarifyResult & { source: ClarifySource }> {
  if (process.env.OPENROUTER_API_KEY?.trim()) {
    const result = await clarifyWithOpenRouter(brief, answers);
    return { ...result, source: "openrouter" };
  }
  return { ...nextTurn(brief, answers), source: "local" };
}
