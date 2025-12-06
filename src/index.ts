import { Hono } from "hono";

import { OpenAI } from "openai";

const app = new Hono<{ Bindings: CloudflareBindings }>();
app.get("/", (c) => {
  return c.text("Hello Hono!");
});

interface CloudflareBindings {
  DEEPGRAM_KEY: string;
  OPENAI_API_KEY: string;
}

// // Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "openai-tts-proxy",
  });
});

// Proxy all requests to /api/openai/* to OpenAI API
// app.use('/api/openai', createProxyMiddleware(openaiProxyOptions))

app.post("/api/audio/speech", async (c) => {


  // Validate and fix the request body
  const { model, input, voice, apiKey, ...otherParams } = await c.req.json();
  const openai = new OpenAI({
    apiKey:  apiKey || c.env.OPENAI_API_KEY,
  });
  const response = await openai.audio.speech.create({
    model: "tts-1",
    input,
    voice,
    ...otherParams,
  });
  return response;
});

app.post("/api/text/completions", async (c) => {
  const { input, apiKey, ...otherParams } = await c.req.json();
  const openai = new OpenAI({
    apiKey: apiKey || c.env.OPENAI_API_KEY,
  });
  const response = await openai.responses.create({
    model: "gpt-5-nano",
    input,
    ...otherParams,
  });

  return c.json(response.output_text);
});

export default app;
