import { MarkdownAsync } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeShiki from "@shikijs/rehype";
import { slugify } from "./table-of-contents";
import type { Components } from "react-markdown";

/**
 * Custom heading components that generate IDs matching the TOC slugify logic.
 * This ensures anchor links from TableOfContents scroll to the correct heading.
 */
function createHeadingComponent(Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") {
  return function HeadingComponent({
    children,
    ...props
  }: React.ComponentProps<typeof Tag>) {
    const text = extractTextFromChildren(children);
    const id = slugify(text);
    return (
      <Tag id={id} {...props}>
        {children}
      </Tag>
    );
  };
}

/**
 * Extract plain text from React children (handles nested elements).
 */
function extractTextFromChildren(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join("");
  }
  if (children && typeof children === "object" && "props" in children) {
    return extractTextFromChildren(
      (children as React.ReactElement<{ children?: React.ReactNode }>).props.children
    );
  }
  return "";
}

const headingComponents: Partial<Components> = {
  h1: createHeadingComponent("h1"),
  h2: createHeadingComponent("h2"),
  h3: createHeadingComponent("h3"),
  h4: createHeadingComponent("h4"),
  h5: createHeadingComponent("h5"),
  h6: createHeadingComponent("h6"),
};

/**
 * Server-side Markdown renderer with shiki syntax highlighting.
 * Uses react-markdown v10 MarkdownAsync for async rehype plugin support in RSC.
 *
 * - remarkGfm: GitHub Flavored Markdown (tables, strikethrough, autolinks, etc.)
 * - rehypeShiki: Syntax highlighting with dual light/dark themes via CSS variables
 * - Custom heading components generate IDs matching the TOC slugify function
 */
export async function ArticleContent({ markdown }: { markdown: string }) {
  return (
    <article className="prose prose-zinc dark:prose-invert max-w-none">
      <MarkdownAsync
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [
            rehypeShiki,
            {
              themes: { light: "github-light", dark: "github-dark" },
              defaultColor: false,
            },
          ],
        ]}
        components={headingComponents}
      >
        {markdown}
      </MarkdownAsync>
    </article>
  );
}
