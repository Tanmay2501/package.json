const express = require("express");

const app = express();

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
              description: "Array of rows to append to the sheet",
            }
          },
          required: ["rows"]
        }
      }
    ]
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
