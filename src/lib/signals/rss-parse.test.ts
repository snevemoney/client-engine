import { describe, it, expect } from "vitest";
import Parser from "rss-parser";

const parser = new Parser();

describe("RSS parser", () => {
  it("parses RSS XML and returns items with title, link", async () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <item>
      <title>First Item</title>
      <link>https://example.com/1</link>
      <description>First description</description>
      <pubDate>Mon, 20 Jan 2025 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Second Item</title>
      <link>https://example.com/2</link>
    </item>
  </channel>
</rss>`;

    const feed = await parser.parseString(rss);
    expect(feed.title).toBe("Test Feed");
    expect(feed.items).toHaveLength(2);
    expect(feed.items![0].title).toBe("First Item");
    expect(feed.items![0].link).toBe("https://example.com/1");
    expect(feed.items![0].contentSnippet).toBeTruthy();
    expect(feed.items![1].title).toBe("Second Item");
  });

  it("deduplicates by URL when same link appears", async () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test</title>
    <item><title>One</title><link>https://example.com/a</link></item>
    <item><title>Two</title><link>https://example.com/b</link></item>
    <item><title>One Again</title><link>https://example.com/a</link></item>
  </channel>
</rss>`;

    const feed = await parser.parseString(rss);
    const seen = new Set<string>();
    const unique = feed.items!.filter((i) => {
      const url = i.link || i.guid || "";
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });
    expect(unique).toHaveLength(2);
  });
});
