import { Mastra, createTool } from "@mastra/core";

import { MDocument } from "@mastra/rag";
import { z } from "zod";

const mastra = new Mastra();

const llm = mastra.LLM({
  provider: "OPEN_AI",
  name: "gpt-4o-mini",
});

export const describeImage = async (url: string) => {
  const response = await llm.generate([
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "describe the image",
        },
        {
          type: "image",
          image: new URL(url),
        },
      ],
    },
  ]);

  return response.text;
};

export const describeImageTool = createTool({
  id: "Describe Image",
  inputSchema: z.object({
    url: z.string(),
  }),
  description: `Fetches the content of a given URL`,
  execute: async ({ context: { url } }) => {
    console.log("Using tool to fetch content for", url);
    return await describeImage(url);
  },
});
