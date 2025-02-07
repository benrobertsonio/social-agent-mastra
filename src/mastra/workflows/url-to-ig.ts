import { Step, Workflow } from "@mastra/core/workflows";

import { Mastra } from "@mastra/core";
import buildPrompt from "../../utils/buildPrompt";
import { describeImage } from "../tools/describe-image";
import { fetchUrlTool } from "../tools/fetch-url";
import { unescape } from "querystring";
import { z } from "zod";

const createInstagramPostWorkflow = new Workflow({
  name: "create-instagram-post",
  triggerSchema: z.object({
    url: z.string(),
  }),
});

// describe images
const describeImagesStep = new Step({
  id: "describe-images",
  execute: async ({ context }) => {
    try {
      console.log("Starting describe images step with context:", {
        triggerData: context.machineContext?.triggerData,
        fetchResults: context.machineContext?.stepResults?.["Fetch URL"],
      });

      const triggerUrl = new URL(context.machineContext?.triggerData.url);
      const baseUrl = `${triggerUrl.protocol}//${triggerUrl.host}`;

      const data = context.machineContext?.stepResults?.["Fetch URL"];
      if (!data || data.status !== "success") {
        console.error("Fetch URL data:", data);
        throw new Error("No data found from Fetch URL step");
      }

      if (!Array.isArray(data.payload.imageUrls)) {
        console.error("Invalid imageUrls format:", data.payload.imageUrls);
        throw new Error("imageUrls is not an array");
      }

      console.log(`About to describe ${data.payload.imageUrls.length} images`);

      const chunkSize = 10;
      const images: Array<{
        url: string;
        description: string;
        success: boolean;
      }> = [];
      const errors: Array<{ url: string; error: string }> = [];
      // Only process first 10 images
      data.payload.imageUrls = data.payload.imageUrls.slice(0, 10);

      for (let i = 0; i < data.payload.imageUrls.length; i += chunkSize) {
        const chunk = data.payload.imageUrls.slice(i, i + chunkSize);
        console.log(`Processing chunk ${i / chunkSize + 1}, urls:`, chunk);

        const chunkResults = await Promise.all(
          chunk.map(async (imageUrl) => {
            try {
              let url = imageUrl.startsWith("/")
                ? `${baseUrl}${imageUrl}`
                : imageUrl;
              url = url.replace(/&amp;/g, "&");
              url = unescape(url);
              url = new URL(url).href;
              console.log(`Processing image: ${url}`);

              const description = await describeImage(url);
              console.log(
                `Got description for ${url}:`,
                description.slice(0, 50) + "..."
              );
              return { url, description, success: true };
            } catch (error) {
              console.error(`Failed to process image ${imageUrl}:`, error);
              errors.push({ url: imageUrl, error: error.message });
              return {
                url: imageUrl,
                description: null,
                success: false,
                error: error.message,
              };
            }
          })
        );

        images.push(...chunkResults.filter((r) => r.success));
        console.log(
          `Processed ${images.length}/${data.payload.imageUrls.length} images`
        );

        if (errors.length > 0) {
          console.log(`Encountered ${errors.length} errors so far:`, errors);
        }
      }

      const result = {
        images,
        errors,
        totalProcessed: images.length,
        totalErrors: errors.length,
      };

      console.log("Final result:", result);
      return result;
    } catch (error) {
      console.error("Top level error in describeImagesStep:", error);
      throw error;
    }
  },
});

const generatePostStep = new Step({
  id: "generate-post",
  execute: async ({ context, mastra }) => {
    const describeImagesResult =
      context.machineContext?.stepResults?.["describe-images"];

    if (!describeImagesResult || describeImagesResult.status !== "success") {
      throw new Error("Describe Images step failed");
    }

    const pageContentResult =
      context.machineContext?.stepResults?.["Fetch URL"];

    if (!pageContentResult || pageContentResult.status !== "success") {
      throw new Error("Fetch URL step failed");
    }

    console.log({ pageContentResult, describeImagesResult });
    if (!mastra?.llm) {
      throw new Error("No LLM found");
    }

    const llm = mastra.llm({
      provider: "ANTHROPIC",
      name: "claude-3-5-sonnet-20240620",
    });
    const prompt = buildPrompt(
      pageContentResult.payload.chunks,
      describeImagesResult.payload.images
    );

    console.log({
      chunks: pageContentResult.payload.chunks,
    });

    console.log({ prompt });

    const postSchema = z.object({
      post: z.object({
        caption: z.string(),
        hashtags: z.array(z.string()),
        images: z.array(z.string()),
        firstComment: z.string(),
      }),
    });

    const response = await llm.generate(prompt, {
      output: postSchema,
    });

    return response.object;
  },
});

createInstagramPostWorkflow
  .step(fetchUrlTool)
  .then(describeImagesStep)
  .then(generatePostStep)
  .commit();

// example usage:
// const { runId, start } = createInstagramPostWorkflow.createRun();

// const res = await start({
//   triggerData: {
//     url: "https://example.com",
//   },
// });

export { createInstagramPostWorkflow };

// generate post
