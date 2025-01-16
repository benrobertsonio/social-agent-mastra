import { PgVector, createVectorQueryTool } from "@mastra/rag";

import { Mastra } from "@mastra/core";
import fetch from "node-fetch";

const mastra = new Mastra();

// Initialize vector store
const pgVector = new PgVector({
  connectionString: process.env.POSTGRES_URL,
});

// Create vector query tool
const vectorQueryTool = createVectorQueryTool({
  vectorStore: pgVector,
});

// Add RAG functions
mastra.indexContent = async (url, metadata) => {
  try {
    if (!url || typeof url !== "string") {
      throw new Error("URL is required and must be a string");
    }

    // Validate URL
    try {
      new URL(url);
    } catch (e) {
      throw new Error(`Invalid URL: ${url}`);
    }

    // Fetch HTML from URL
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SocialAgent/1.0; +http://example.com)",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch URL (${response.status}): ${response.statusText}`
      );
    }

    const html = await response.text();
    if (!html) {
      throw new Error("Empty response from URL");
    }

    console.log(`Successfully fetched HTML from ${url} (${html.length} bytes)`);

    const chunks = await vectorQueryTool.chunkHtml(html, {
      strategy: "recursive",
      size: 1000,
      overlap: 200,
    });

    console.log(`Created ${chunks.length} chunks from HTML`);

    const embeddings = await vectorQueryTool.createEmbeddings(chunks);
    console.log(`Generated ${embeddings.length} embeddings`);

    const vectorIds = await vectorQueryTool.storeVectors(embeddings, metadata);
    console.log(`Stored vectors with IDs: ${vectorIds.join(", ")}`);

    return {
      success: true,
      chunks_count: chunks.length,
      embeddings_count: embeddings.length,
      vector_ids: vectorIds,
    };
  } catch (error) {
    console.error("Error indexing content:", error);
    throw error;
  }
};

mastra.generateSocialPostIdeas = async (query) => {
  try {
    if (!query || typeof query !== "string") {
      throw new Error("Query is required and must be a string");
    }

    const results = await vectorQueryTool.query(query, {
      limit: 5,
      minScore: 0.7,
    });

    console.log(`Found ${results.length} relevant chunks for query: ${query}`);

    const prompt = `Based on the following content, generate 3 social media post ideas that would be engaging and informative:

Content:
${results.map((r) => r.text).join("\n\n")}

Generate 3 post ideas that:
1. Are engaging and encourage interaction
2. Include relevant hashtags
3. Maintain a professional but friendly tone
4. Are optimized for the platform (Twitter-style)
5. Include a call to action when appropriate

Post Ideas:`;

    const response = await mastra.generate(prompt);
    return response.text;
  } catch (error) {
    console.error("Error generating post ideas:", error);
    throw error;
  }
};

export { mastra };
