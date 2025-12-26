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


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
