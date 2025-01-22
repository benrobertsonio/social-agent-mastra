import { Step, Workflow } from "@mastra/core";

import contentCalendarPrompt from "../../utils/contentCalendarPrompt";
import { z } from "zod";

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

    // const llm = mastra.llm({
    //   provider: "OPEN_AI",
    //   name: "gpt-4o",
    // });

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

const createInstagramPostsStep = new Step({
  id: "create-instagram-posts",
  execute: async ({ context, mastra }) => {
    console.log("Creating Instagram posts with context:", context);

    const stepContext =
      context.machineContext?.stepResults?.["create-content-calendar"];

    console.log("Step context:", stepContext);

    const content = stepContext?.payload?.content;

    for (const item of content) {
      console.log("Creating Instagram post for:", item);

      // use item to do an embedding search to find the most relevant content
      // get the url of the content
      // use url to ig workflow + the topic to create the post
    }
  },
});

createInstagramContentCalendar.step(createContentCalendarStep).commit();

export { createInstagramContentCalendar };
