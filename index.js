const express = require("express");

const app = express();
app.use(express.json());


app.get("/", (req, res) => {
  res.send("MCP server is running");
});
app.get("/mcp", (req, res) => {
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
              description: "Array of rows to append to the sheet"
            }
          },
          required: ["rows"]
        }
      }
    ]
  });
});
const { google } = require("googleapis");

function getSheetsClient() {
  const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

  const auth = new google.auth.JWT(
    key.client_email,
    null,
    key.private_key,
    ["https://www.googleapis.com/auth/spreadsheets"]
  );

  return google.sheets({ version: "v4", auth });
}
app.post("/call_tool", async (req, res) => {
  try {
    const { tool, input } = req.body;

    if (tool !== "export_to_sheet") {
      return res.status(400).json({ error: "Unknown tool" });
    }

    const rows = input.rows;

    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: "rows must be an array" });
    }

    const sheets = getSheetsClient();

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SHEET_ID,
      range: "Sheet1",
      valueInputOption: "RAW",
      requestBody: {
        values: rows
      }
    });

    res.json({
      status: "success",
      appendedRows: rows.length
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.flushHeaders();

  // Initial handshake event
  res.write(`event: ready\ndata: {}\n\n`);

  // Keep connection alive
  const interval = setInterval(() => {
    res.write(`event: ping\ndata: {}\n\n`);
  }, 15000);

  req.on("close", () => {
    clearInterval(interval);
    res.end();
  });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
