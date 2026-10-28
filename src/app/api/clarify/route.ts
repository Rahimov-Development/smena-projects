import { cleanAnswers, cleanBrief } from "@/lib/brief";
import { clarifyBrief } from "@/lib/clarify";
import { redactSecrets } from "@/lib/stripe-key";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send the task as JSON." }, { status: 400 });
  }

  try {
    const record = body as { brief?: unknown; answers?: unknown };
    const brief = cleanBrief(record.brief);
    const answers = cleanAnswers(record.answers);
    const result = await clarifyBrief(brief, answers);
    return Response.json(result);
  } catch (error) {
    const message = redactSecrets(
      error instanceof Error ? error.message : "Could not continue.",
    );
    const status = message.startsWith("OpenRouter") ? 502 : 400;
    return Response.json({ error: message }, { status });
  }
}
