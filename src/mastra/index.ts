import { Mastra } from "@mastra/core";
import { PgVector } from "@mastra/vector-pg";
import { contentPipeline } from "./workflows";
import { createBrandVoice } from "./workflows/brand-voice";
import { createInstagramContentCalendar } from "./workflows/content-calendar";
import { createInstagramPostWorkflow } from "./workflows/url-to-ig";
import generatePost from "./workflows/generate-post";
import { ragAgent } from "./agents/rag-agent";

const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);

// Initialize Mastra with our components
export const mastra = new Mastra({
  agents: { ragAgent },
  workflows: {
    content: contentPipeline,
    createInstagramPost: createInstagramPostWorkflow,
    createInstagramContentCalendar: createInstagramContentCalendar,
    createBrandVoice: createBrandVoice,
    generatePost: generatePost,
  },
  vectors: { pgVector },
});
