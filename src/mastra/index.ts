import { Mastra } from "@mastra/core";
import { PgVector } from "@mastra/rag";
import { contentPipeline } from "./workflows";
import { ragAgent } from "./agents";

const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);

// Initialize Mastra with our components
export const mastra = new Mastra({
  agents: { ragAgent },
  workflows: {
    content: contentPipeline,
  },
  vectors: { pgVector } as any, // TODO: Fix type once @mastra/core and @mastra/rag are stable
});
