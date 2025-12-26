// index.js - final MCP server for ChatGPT -> Google Sheets Export
const express = require("express");
const { google } = require("googleapis");

const app = express();
app.use(express.json());

// Small helper to set permissive CORS on each response
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// --------- Root SSE (MCP stream) - required by ChatGPT ----------
app.get("/", (req, res) => {
  setCors(res);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // ensure headers are flushed immediately
  if (res.flushHeaders) res.flushHeaders();

  // IMPORTANT: comment heartbeat first so ChatGPT doesn't time out
  res.write(`: connected\n\n`);

  // MCP ready event
  res.write(`event: mcp.ready\ndata: {}\n\n`);

  // Keep connection alive periodically with comment pings
  const interval = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 10000);

  req.on("close", () => {
    clearInterval(interval);
    try { res.end(); } catch (e) {}
  });
});

// --------- MCP metadata endpoint (what ChatGPT reads) ----------
app.get("/mcp", (req, res) => {
  setCors(res);
  res.json({
    name: "ChatGPT Export App",
    description: "Export structured data from ChatGPT to Google Sheets",
    tools: [
      {
        name: "export_to_sheet",
        description: "Export rows of data into a Google Sheet",
        input_schema: {
          type: "object",
          properties: {
            rows: {
              type: "array",
              description: "Array of rows to append to the sheet (each item is an array of cell values)"
            }
          },
          required: ["rows"]
        }
      }
    ]
  });
});

// --------- Google Sheets auth helper ----------
async function getSheetsClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT env var");
  const key = JSON.parse(raw);

  const jwt = new google.auth.JWT(
    key.client_email,
    null,
    key.private_key,
    ["https://www.googleapis.com/auth/spreadsheets"]
  );

  // Explicitly authorize so the first call doesn't fail due to race
  await jwt.authorize();

  return google.sheets({ version: "v4", auth: jwt });
}

// --------- Tool execution endpoint ----------
app.post("/call_tool", async (req, res) => {
  setCors(res);
  try {
    const { tool, input } = req.body;

    if (tool !== "export_to_sheet") {
      return res.status(400).json({ error: "Unknown tool" });
    }

    const rows = input?.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "input.rows must be a non-empty array" });
    }

    const sheets = await getSheetsClient();

    const spreadsheetId = process.env.SHEET_ID;
    if (!spreadsheetId) return res.status(500).json({ error: "Missing SHEET_ID env var" });

    const sheetName = process.env.SHEET_NAME || "Sheet1";

    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: rows }
    });

    const updates = appendRes.data.updates || {};
    const appendedRows = updates.updatedRows || rows.length;

    return res.json({
      status: "success",
      appendedRows,
      spreadsheetId,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    });
  } catch (err) {
    console.error("call_tool error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
});

// Health fallback (not used by ChatGPT, but nice to have for humans)
app.get("/healthz", (req, res) => {
  setCors(res);
  res.json({ ok: true });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP server listening on port ${PORT}`);
});
