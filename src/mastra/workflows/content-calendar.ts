import { PgVector } from "@mastra/vector-pg";
import { Step, Workflow } from "@mastra/core/workflows";
import { embed } from "@mastra/rag";
import { z } from "zod";
import contentCalendarPrompt from "../../utils/contentCalendarPrompt";
import { createInstagramPostWorkflow } from "./url-to-ig";

const createInstagramContentCalendar = new Workflow({
  name: "create-instagram-content-calendar",
  triggerSchema: z.object({
    brandVoice: z.string(),
    audience: z.string(),
    description: z.string(),
    dateRange: z.string(),
    postsPerDay: z.number(),
  }),
});

const createContentCalendarStep = new Step({
  id: "create-content-calendar",
  execute: async ({ context, mastra }) => {
    console.log("Creating content calendar with context:", context);

    const triggerData = context.machineContext?.triggerData;

    console.log("Trigger data:", triggerData);

    const prompt = contentCalendarPrompt(
      triggerData?.brandVoice,
      triggerData?.audience,
      triggerData?.description,
      triggerData?.dateRange,
      triggerData?.postsPerDay
    );

    console.log("Prompt:", prompt);

    if (!mastra?.llm) {
      throw new Error("No LLM found");
    }

    const llm = mastra.llm({
      provider: "ANTHROPIC",
      name: "claude-3-5-haiku-20241022",
    });

    const calendarSchema = z.object({
      content: z.array(
        z.object({
          topic: z.string(),
          searchTerms: z.array(z.string()),
        })
      ),
    });

    const response = await llm.generate(prompt, {
      output: calendarSchema,
    });

    return response.object;
  },
});

const processContentItem = new Step({
  id: "process-content-item",
  execute: async ({ context }) => {
    const item = context.machineContext?.triggerData;

    const { embedding } = await embed(item.searchTerms.join(" "), {
      provider: "OPEN_AI",
      model: "text-embedding-3-small",
      maxRetries: 3,
    });

    const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);
    const results = await pgVector.query("content_embeddings", embedding, 10);

    return {
      topic: item.topic,
      url: results[0]?.metadata?.url,
    };
  },
});

const createPost = new Step({
  id: "create-post",
  execute: async ({ context }) => {
    const { url } =
      context.machineContext?.stepResults?.["process-content-item"].payload;
    if (!url) {
      console.log(
        "No URL found for topic:",
        context.machineContext?.triggerData.topic
      );
      return null;
    }

    try {
      console.log(`Starting Instagram post creation for URL: ${url}`);
      const { start } = createInstagramPostWorkflow.createRun();

      // wait for the workflow to complete and get all results
      const workflowResult = await start({ triggerData: { url } });
      console.log(
        "Workflow completed, results:",
        JSON.stringify(workflowResult, null, 2)
      );

      // specifically check the generate-post step results
      const generatePostResults = workflowResult.results?.["generate-post"];
      if (!generatePostResults || generatePostResults.status !== "success") {
        console.error("Generate post step failed:", generatePostResults);
        throw new Error("Failed to generate post");
      }

      return {
        topic: context.machineContext?.triggerData.topic,
        url,
        post: generatePostResults.payload.post,
      };
    } catch (error) {
      console.error(`Failed to create post for ${url}:`, error);
      throw error; // let the workflow handle the error
    }
  },
});

const createInstagramPostsStep = new Step({
  id: "create-instagram-posts",
  execute: async ({ context }) => {
    console.log("Starting createInstagramPostsStep");

    const stepContext =
      context.machineContext?.stepResults?.["create-content-calendar"];
    const content = stepContext?.payload?.content;

    if (!content || !Array.isArray(content)) {
      console.error("No content array found:", stepContext);
      throw new Error("No content array found in step context");
    }

    console.log(`Processing ${content.length} content items`);

    const parallelWorkflow = new Workflow({
      name: "process-single-post",
      triggerSchema: z.object({
        topic: z.string(),
        searchTerms: z.array(z.string()),
      }),
    });

    parallelWorkflow.step(processContentItem).then(createPost).commit();

    // add timeouts and error handling to each promise
    const postPromises = content.map(async (item, index) => {
      try {
        console.log(`Starting item ${index}: ${item.topic}`);
        const { start } = parallelWorkflow.createRun();
        const result = await Promise.race([
          start({ triggerData: item }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`Timeout for item ${index}`)),
              300000
            )
          ),
        ]);
        console.log(
          `Completed item ${index}. Generated post:`,
          JSON.stringify(
            {
              topic: item.topic,
              result,
            },
            null,
            2
          )
        );
        return result;
      } catch (error) {
        console.error(`Failed item ${index}:`, error);
        return null;
      }
    });

    console.log("Waiting for all posts to complete...");
    const posts = await Promise.all(postPromises);
    console.log(
      `Completed ${posts.filter(Boolean).length}/${posts.length} posts`
    );

    return { posts: posts.filter(Boolean) };
  },
});

createInstagramContentCalendar
  .step(createContentCalendarStep)
  .then(createInstagramPostsStep)
  .commit();

export { createInstagramContentCalendar };
