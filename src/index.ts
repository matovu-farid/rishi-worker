import { Hono } from 'hono'

import { OpenAI } from "openai";

const app = new Hono<{ Bindings: CloudflareBindings, }>();
app.get('/', (c) => {
  return c.text('Hello Hono!')
})


interface CloudflareBindings {
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
  const openai = new OpenAI({
    apiKey: c.env.OPENAI_API_KEY,
  });

  // Validate and fix the request body
  const { model, input, voice, ...otherParams } = await c.req.json();
  const response = await openai.audio.speech.create({
    model,
    input,
    voice,
    ...otherParams,
  });
  return response

});





export default app;

