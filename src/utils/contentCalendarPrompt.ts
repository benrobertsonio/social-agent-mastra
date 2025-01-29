export default function contentCalendarPrompt(
  voice: string,
  audience: string,
  description: string,
  dateRange: string,
  postsPerDay: number
) {
  return `
    given the following info about a website, 
    draft ${postsPerDay} Instagram posts for each day in ${dateRange}, 
    so if there are any holidays or special events we can tie into, use those. 
    for each topic, generate specific 3 search terms that I can use to perform embedding searches on my website to find relevant content.
    
    <brand voice>
    ${voice}
    </brand voice>
    <audience>
    ${audience}
    </audience>
    <description>
    ${description}
    </description>
    `;
}
