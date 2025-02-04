export default function buildPrompt(
  content: { text: string; url: string }[],
  images: { url: string; description: string }[]
) {
  return `
 You are a social media content creator specializing in crafting engaging Instagram posts. Your task is to create a compelling post based on web content and image descriptions.

First, review the following web content:

<web_content>
${content.map((chunk) => `<web_content>${chunk.text}</web_content>`).join("\n")}
</web_content>

Now, consider the descriptions of the images associated with this content:

<image_descriptions>
${images.map((image) => `<image_url>${image.url}</image_url><image_description>${image.description}</image_description>`).join("\n")}
</image_descriptions>


1. Draft a caption, using one of the following hooks: ${randomHook()}

2. Select hashtags:
   - Choose 5-7 relevant hashtags that relate to the content and images
   - Include a mix of popular and niche hashtags to increase discoverability

4. Format your Instagram post:
   - Write your caption, keeping it under 2200 characters
   - Include your hashtags, starting each with #
   - Suggest which of the described images would be best to use for this post, or describe an ideal image if none of the provided descriptions seem suitable



Then, present your Instagram post using the following structure:

<instagram_post>
<caption>
[Your caption here]
.
.
.
[Your hashtags here]
</caption>

<first_comment>
[call to action and url here]
</first_comment


<images_suggestion>
[the urls of the images to be used for the post]
</images_suggestion>
</instagram_post>

Remember to keep the tone conversational and engaging, as if you're speaking directly to the audience. Avoid using jargon unless it's appropriate for the target audience. Your goal is to create a post that will resonate with Instagram users and encourage them to interact with the content.
    `;
}

const randomHook = () => {
  const hooks = [
    "Calling all …. (identify a specific audience such as web designers, social media managers, digital marketers, coaches, therapists etc.)",
    "Can I share a secret?",
    "Write a joke if your brand voice allows it.",
    "Which one are you? A)… or B)…",
    "Did you know …. (share an interesting statistic)",
    "How to …",
    "Fun fact: …. (share a fun fact about the day, month, industry etc.",
    "Start with a quote from influencers in your niche ",
    "Unpopular opinion: … (share your unpopular opinion)",
    "Start with using interesting words",
    "Address your niche with a sentence such as: “Hey social media managers, I see you over there juggling a million things at once.”",
    "The craziest thing just happened, you will never believe it….”",
    "I wasn’t going to share this, but …”",
    "I’ll tell you a secret no one has ever told you.”",
    "The biggest lesson I’ve learned in my life.”",
    "You need to hear this today.”",
    "Let’s figure out why!”",
    "X things I learned this year”",
    "Do you only focus on …? Let me stop you right there.",
    "Here’s how I know … is possible for you",
    "X Steps to …",
    "I can’t believe … but …",
    "Hate …? You are in luck.",
    "Tips when …. (creating your social media posts, organizing your room etc.)",
    "X accounts you need to be following today!",
    "Let’s talk about …",
    "Mistakes I made when …",
    "Hack you never knew",
    "X Ways to …",
    "How I went from …",
    "You’ll never believe this.",
    "I have a confession to make.",
    "What I wish I had done differently.",
    "Why I don’t …",
    "What to do after …",
  ];

  return hooks[Math.floor(Math.random() * hooks.length)];
};
