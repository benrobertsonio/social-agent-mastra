import { Agent } from "@mastra/core";
import { vectorQueryTool } from "../tools";

// Create our RAG agent
export const ragAgent = new Agent({
  name: "Content RAG Agent",
  instructions: `You are a helpful assistant that processes web content for social media marketing.
  You are given a URL and you need to extract the content and return it in a structured format.
  `,
  model: {
    provider: "OPEN_AI",
    name: "gpt-4o",
    toolChoice: "auto",
  },
  tools: { vectorQueryTool } as any,
});
