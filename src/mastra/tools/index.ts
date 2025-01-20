import { createVectorQueryTool } from "@mastra/rag";

export const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: "pgVector",
  indexName: "content_embeddings",
  options: {
    provider: "OPEN_AI",
    model: "text-embedding-ada-002",
    maxRetries: 3,
  },
  topK: 5,
});
