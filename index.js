import express from "express";
import { paymentMiddleware } from "x402-express";
import { LinkupClient } from "linkup-sdk";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

const linkup = new LinkupClient({ apiKey: process.env.LINKUP_API_KEY });

app.use(paymentMiddleware(
  process.env.WALLET_ADDRESS,
  {
    "GET /search": { price: "$0.01", network: "base-sepolia" },
    "GET /scrape": { price: "$0.02", network: "base-sepolia" },
    "POST /generate": { price: "$0.03", network: "base-sepolia" },
    "POST /combined": { price: "$0.05", network: "base-sepolia" }
  }
));

// 1. Linkup: Real-time search
app.get("/search", async (req, res) => {
  try {
    const result = await linkup.search({
      query: req.query.q,
      depth: "standard",
      outputType: "sourcedAnswer"
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Search failed" });
  }
});

// 2. Firecrawl: Web scraping
app.get("/scrape", async (req, res) => {
  try {
    const response = await axios.post("https://api.firecrawl.dev/v0/crawl", {
      url: req.query.url
    }, {
      headers: { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Scraping failed" });
  }
});

// 3. Hugging Face: AI content generation
app.post("/generate", async (req, res) => {
  try {
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/gpt2",
      { inputs: req.body.prompt },
      { headers: { Authorization: `Bearer ${process.env.HF_API_KEY}` } }
    );
    res.json({ result: response.data[0].generated_text });
  } catch (error) {
    res.status(500).json({ error: "Generation failed" });
  }
});

// 4. Combined: Search → Scrape → Summarize
app.post("/combined", async (req, res) => {
  try {
    const query = req.body.query;
    
    const searchRes = await linkup.search({
      query,
      depth: "standard",
      outputType: "searchResults"
    });
    
    const scrapeRes = await axios.post("https://api.firecrawl.dev/v0/crawl", {
      url: searchRes.results[0].url
    }, {
      headers: { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` }
    });
    
    const summaryRes = await axios.post(
      "https://api-inference.huggingface.co/models/facebook/bart-large-cnn",
      { inputs: scrapeRes.data.content },
      { headers: { Authorization: `Bearer ${process.env.HF_API_KEY}` } }
    );
    
    res.json({
      query,
      summary: summaryRes.data[0].summary_text
    });
  } catch (error) {
    res.status(500).json({ error: "Combined task failed" });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));