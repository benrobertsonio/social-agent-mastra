import { MDocument } from "@mastra/rag";
import { createTool } from "@mastra/core";
import { z } from "zod";

const getContent = async (url: string) => {
  // Replace with an actual API call to a weather service
  const data = await fetch(url).then((r) => r.text());

  // Extract image URLs from HTML
  const imgRegex = /<img[^>]+src="([^">]+)"/g;
  const imageUrls = [...data.matchAll(imgRegex)].map((match) => match[1]);

  const document = MDocument.fromHTML(data);
  const chunks = await document.chunk({
    headers: [
      ["h1", "Header 1"],
      ["h2", "Header 2"],
      ["h3", "Header 3"],
    ],
  });

  return {
    chunks,
    imageUrls,
  };
};

export const fetchUrlTool = createTool({
  id: "Fetch URL",
  inputSchema: z.object({
    url: z.string(),
  }),
  outputSchema: z.object({
    chunks: z.array(z.any()),
    imageUrls: z.array(z.string()),
  }),
  description: `Fetches the content of a given URL`,
  execute: async ({ context }) => {
    console.log(
      "Using tool to fetch content for",
      context.machineContext?.triggerData.url
    );
    return await getContent(context.machineContext?.triggerData.url);
  },
});
