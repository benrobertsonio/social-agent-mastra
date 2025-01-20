import { EmbedManyResult, Step, Workflow, embed } from "@mastra/core";

import { MDocument } from "@mastra/rag";
import { z } from "zod";

const contentPipeline = new Workflow({
  name: "content",
  triggerSchema: z.object({
    url: z.string(),
    metadata: z.record(z.any()),
  }),
});

const fetchContentStep = new Step({
  id: "fetch-content",
  execute: async ({ context }) => {
    const url = context.machineContext?.triggerData.url;
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

      console.log(
        `Successfully fetched HTML from ${url} (${html.length} bytes)`
      );

      return {
        content: html,
      };
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
});

const embedStep = new Step({
  id: "embed-content",
  execute: async ({ context, mastra }) => {
    if (
      context.machineContext?.stepResults?.["fetch-content"]?.status !==
      "success"
    ) {
      throw new Error("Fetch content step failed");
    }

    const metadata = context.machineContext?.triggerData.metadata || {};

    const html =
      context.machineContext?.stepResults?.["fetch-content"]?.payload?.content;

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
    const textChunks = validChunks.map((chunk) => chunk.text);
    // console.log("Text chunks:", textChunks);

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
    return {
      embeddings,
      chunks: chunksWithMetadata,
    };
  },
});

const upsertStep = new Step({
  id: "upsert-embeddings",
  execute: async ({ context, mastra }) => {
    if (
      context.machineContext?.stepResults?.["embed-content"]?.status !==
      "success"
    ) {
      throw new Error("Fetch embed step failed");
    }

    const vector = mastra?.vectors?.pgVector;

    if (!vector) {
      throw new Error("Vector store not found");
    }

    const { embeddings, chunks } =
      context.machineContext?.stepResults?.["embed-content"]?.payload;

    // Create index if it doesn't exist (1536 is OpenAI's embedding dimension)
    await vector.createIndex("content_embeddings", 1536).catch((e) => {
      // Index might already exist, that's fine
      console.error("Error creating index:", e);
    });

    console.log("Upserting embeddings with metadata");
    try {
      // Debug logs
      console.log("=== DEBUG UPSERT ===");
      console.log("Embeddings format:", {
        length: embeddings.length,
        sampleDimensions: embeddings[0]?.length,
        sampleFirst: embeddings[0]?.slice(0, 5),
      });
      console.log("Metadata format:", {
        length: chunks.length,
        sample: chunks[0],
      });

      const result = await vector.upsert(
        "content_embeddings",
        embeddings,
        chunks
      );
      console.log("=== POST UPSERT CHECK ===");
      console.log("Upsert result:", result);

      // Verify the data actually made it
      const count = await vector.describeIndex(`content_embeddings`);
      console.log("Row count:", count);
    } catch (e) {
      console.error("Error upserting embeddings:", e);
      throw e; // rethrow to maintain error handling
    }

    return {
      success: true,
      chunks_count: chunks.length,
      embeddings_count: embeddings.length,
    };
  },
});

contentPipeline
  .step(fetchContentStep)
  .then(embedStep)
  .then(upsertStep)
  .commit();

export { contentPipeline };
