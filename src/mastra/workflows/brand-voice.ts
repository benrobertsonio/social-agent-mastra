import { Step, Workflow } from "@mastra/core/workflows";
import { z } from "zod";

const createBrandVoice = new Workflow({
  name: "create-brand-voice",
  triggerSchema: z.object({
    url: z.string(),
  }),
});

const analyzeWebsiteSchema = z.object({
  description: z.string(),
  brandVoice: z.string(),
  audience: z.string(),
});

const analyzeWebsiteStep = new Step({
  id: "analyze-website",
  execute: async ({ context, mastra }) => {
    try {
      console.log("Analyzing website with context:", context);

      // Fetch with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const website = await fetch(context.machineContext?.triggerData.url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; SocialAgent/1.0; +http://example.com)",
        },
      });

      clearTimeout(timeout);

      if (!website.ok) {
        throw new Error(
          `Failed to fetch website: ${website.status} ${website.statusText}`
        );
      }

      const websiteData = await website.text();

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

      const response = await llm.generate(
        `Analyze the following html, determining the following:
    
         * Describe the website and its offerings/products/services
         * Describe the brand voice and tone
         * Describe the audience of the website
             
        <html>
        ${websiteData}
        </html>
             `,
        {
          output: analyzeWebsiteSchema,
        }
      );

      return response.object;
    } catch (error) {
      console.error("Error analyzing website:", error);

      if (error.name === "AbortError") {
        throw new Error("Website took too long to respond");
      }

      throw error;
    }
  },
});

createBrandVoice.step(analyzeWebsiteStep).commit();

export { createBrandVoice };
