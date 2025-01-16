import { Agent, EmbedManyResult, Mastra, createTool } from "@mastra/core";
import { MDocument, PgVector, createVectorQueryTool, embed } from "@mastra/rag";

import fetch from "node-fetch";
import { z } from "zod";

export const indexContentTool = createTool({
  id: "index-content",
  description: "Index content from a URL",
  inputSchema: z.object({
    url: z.string().describe("URL to index"),
    metadata: z.record(z.string(), z.any()).describe("Metadata to index"),
  }),
  execute: async ({ context }) => {
    console.log("Indexing content for URL:", context.url);
    return await indexContent(context.url, context.metadata);
  },
});

const indexContent = async (
  url: string,
  metadata: Record<string, any> = {}
) => {
  try {
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

    // Create document from HTML
    const doc = MDocument.fromHTML(html);

    const chunks = await doc.chunk({
      headers: [
        ["h1", "Header 1"],
        ["p", "Paragraph"],
      ],
    });

    // Filter out empty chunks
    const validChunks = chunks.filter(
      (chunk) => chunk.text && chunk.text.trim().length > 0
    );
    console.log("Valid chunks after filtering:", validChunks.length);

    // convert chunks to text
    const textChunks = validChunks.map((chunk) => chunk.toString());
    console.log("Text chunks:", textChunks);

    // Generate embeddings for the chunks
    const { embeddings } = (await embed(textChunks, {
      provider: "OPEN_AI",
      model: "text-embedding-ada-002",
      maxRetries: 3,
    })) as EmbedManyResult<string>;

    // Prepare metadata for each chunk
    const chunksWithMetadata = validChunks.map((chunk: any, index: number) => ({
      text: chunk.text,
      metadata: {
        ...metadata,
        chunk_index: index,
        heading: chunk.metadata?.heading,
        parent_tag: chunk.metadata?.parentTag,
      },
    }));

    // Store in vector database
    const vectorStore = mastra.getVector("pgVector");

    // Create index if it doesn't exist (1536 is OpenAI's embedding dimension)
    await vectorStore.createIndex("content_embeddings", 1536).catch((e) => {
      // Index might already exist, that's fine
      console.error("Error creating index:", e);
    });

    // Store embeddings with metadata
    await vectorStore.upsert(
      "content_embeddings",
      embeddings,
      chunksWithMetadata
    );

    return {
      success: true,
      chunks_count: chunks.length,
      embeddings_count: embeddings.length,
    };
  } catch (error) {
    console.error("Error indexing content:", error);
    throw error;
  }
};

const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);

// Create vector query tool for searching
const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: "pgVector",
  indexName: "content_embeddings",
  options: {
    provider: "OPEN_AI",
    model: "text-embedding-ada-002",
    maxRetries: 3,
  },
  topK: 5,
}) as any; // TODO: Fix type once @mastra/core and @mastra/rag are stable

// Create our RAG agent
const ragAgent = new Agent({
  name: "Content RAG Agent",
  instructions: `You are a helpful assistant that processes web content for social media marketing.
                You help find relevant content and insights that can be used to create engaging social media posts.`,
  model: {
    provider: "OPEN_AI",
    name: "gpt-4",
  },
  tools: {
    indexContent: indexContentTool,
    vectorQueryTool,
  },
});

// Initialize Mastra with our components
export const mastra = new Mastra({
  agents: { ragAgent },
  vectors: { pgVector } as any, // TODO: Fix type once @mastra/core and @mastra/rag are stable
});
