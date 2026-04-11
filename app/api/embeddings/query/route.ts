import { getLLMProvider } from '@/lib/llm/getLLMProvider'

export async function POST(request: Request) {
  const body = await request.json() as { question?: string }
  const question = body.question?.trim()

  if (!question) {
    return Response.json({ error: 'question is required' }, { status: 400 })
  }

  try {
    const llm = getLLMProvider()
    const embedding = await llm.embed(question)
    return Response.json({ embedding })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not embed question'
    return Response.json({ error: message }, { status: 500 })
  }
}
