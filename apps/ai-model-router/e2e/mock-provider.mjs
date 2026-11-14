#!/usr/bin/env node
// Stubbed OpenAI-style provider used by the e2e suite.
// Every provider call the app makes is answered here on loopback, so no real
// provider API is ever contacted and only fake keys are used.
import http from "node:http";

const PORT = Number(process.env.E2E_MOCK_PORT ?? 4105);

const MODELS = ["mock-alpha", "mock-beta"];
const REPLIES = {
  "mock-alpha": "MOCK_ALPHA_REPLY hello from the stubbed provider",
  "mock-beta": "MOCK_BETA_REPLY hello from the stubbed provider",
};

// Fixed usage numbers keep cost math deterministic (100 in / 100 out).
const USAGE = { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 };

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);

  if (req.method === "GET" && url.pathname === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/v1/models") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        object: "list",
        data: MODELS.map((id) => ({ id, object: "model", owned_by: "e2e-mock" })),
      }),
    );
    return;
  }

  if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      let model = "mock-alpha";
      let stream = false;
      try {
        const parsed = JSON.parse(body);
        if (typeof parsed.model === "string") model = parsed.model;
        if (parsed.stream === true) stream = true;
      } catch {
      }
      const text = REPLIES[model] ?? `MOCK_REPLY for ${model}`;

      // A real OpenAI-compatible provider answers a non-streaming request
      // with a plain chat.completion JSON body. Serve SSE only when the
      // caller asked for stream, otherwise the non-streaming client path
      // would JSON.parse an SSE frame.
      if (!stream) {
        res.writeHead(200, {
          "content-type": "application/json",
          "cache-control": "no-store",
        });
        res.end(
          JSON.stringify({
            id: "chatcmpl-e2e-mock",
            object: "chat.completion",
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: text },
                finish_reason: "stop",
              },
            ],
            usage: USAGE,
          }),
        );
        return;
      }

      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-store",
      });
      res.write(
        `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`,
      );
      res.write(
        `data: ${JSON.stringify({ choices: [], usage: USAGE })}\n\n`,
      );
      res.write("data: [DONE]\n\n");
      res.end();
    });
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(
    JSON.stringify({ error: `mock provider has no route for ${req.method} ${url.pathname}` }),
  );
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`e2e mock provider listening on http://127.0.0.1:${PORT}`);
});
