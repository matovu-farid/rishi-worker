import axios, { AxiosError } from "axios";
import { Hono } from "hono";

import { OpenAI } from "openai";
import { z } from "zod";
import { createClerkClient } from "@clerk/backend";

const app = new Hono<{ Bindings: CloudflareBindings }>();
app.get("/", (c) => {
  return c.text("Hello Hono!");
});

interface CloudflareBindings {
  DEEPGRAM_KEY: string;
  OPENAI_API_KEY: string;
  CLERK_SECRET_KEY: string;
}

// // Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "openai-tts-proxy",
  });
});
app.get("/api/clerk/users", async (c) => {
  const clerkClient = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
  const users = await clerkClient.users.getUserList();
  return c.json(users);
});

app.get("/api/clerk/user/:userId", async (c) => {
  const clerkClient = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
  const userId = c.req.param("userId");

  const user = await clerkClient.users.getUser(userId);

  return c.json(user);
});

// Proxy all requests to /api/openai/* to OpenAI API
// app.use('/api/openai', createProxyMiddleware(openaiProxyOptions))

app.post("/api/audio/speech", async (c) => {
  // Validate and fix the request body
  const { model, input, voice, apiKey, ...otherParams } = await c.req.json();
  const openai = new OpenAI({
    apiKey: apiKey || c.env.OPENAI_API_KEY,
  });
  const response = await openai.audio.speech.create({
    model: "tts-1",
    input,
    voice,
    ...otherParams,
  });
  return response;
});

app.get("/api/realtime/client_secrets", async (c) => {
  try {
    //console.log("env", c.env);

    const response = await axios.post(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        expires_after: {
          anchor: "created_at",
          seconds: 600,
        },
        session: {
          type: "realtime",
          model: "gpt-realtime",
          instructions: "You are a friendly assistant.",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${c.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    const responseSchema = z.object({
      value: z.string(),
      expires_at: z.number(),
    });
    const parsedResponse = responseSchema.parse(response.data);
    return c.text(parsedResponse.value);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { error: "Failed to get client secrets, " + error.message },
        500
      );
    }
    if (error instanceof AxiosError) {
      return c.json(
        {
          error:
            "Failed to get client secrets, " +
            error.response?.data.error.message,
        },
        500
      );
    }
    if (error instanceof Error) {
      return c.json(
        { error: "Failed to get client secrets, " + error.message },
        500
      );
    }
    return c.json({ error: "Failed to get client secrets, " }, 500);
  }
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
