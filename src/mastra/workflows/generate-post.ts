import { PgVector } from "@mastra/vector-pg";
import { Step, Workflow } from "@mastra/core/workflows";
import { embed } from "@mastra/rag";
import { z } from "zod";

const createInstagramPost = new Workflow({
  name: "create-post-from-calendar",
  triggerSchema: z.object({
    topic: z.string(),
    searchTerms: z.string(),
    projectId: z.string(),
  }),
});

const findRelatedContentStep = new Step({
  id: "find-related-content",
  execute: async ({ context, mastra }) => {
    console.log("Finding related content with context:", context);

    const triggerData = context.machineContext?.triggerData;

    console.log("Trigger data:", triggerData);

    const topic = triggerData?.topic;
    const searchTerms = triggerData?.searchTerms;

    console.log("Topic:", topic);
    console.log("Search terms:", searchTerms);

    const { embedding } = await embed(searchTerms, {
      provider: "OPEN_AI",
      model: "text-embedding-ada-002",
      maxRetries: 3,
    });

    // Query vector store
    const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);
    const results = await pgVector.query("content_embeddings", embedding, 10, {
      filter: {
        project_id: triggerData?.projectId,
      },
    });

    console.log("Results:", results);

    return {
      relatedContent: results,
    };
  },
});

createInstagramPost.step(findRelatedContentStep).commit();

export default createInstagramPost;
