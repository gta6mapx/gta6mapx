import articlesData from "@/data/articles.json";

export interface Article {
  slug: string;
  keyword: string;
  title: string;
  meta_description: string;
  content: string;
  content_type: "guide" | "qa" | "traffic";
  word_count: number;
  sources: string;
  countries: number;
  volume: string;
  kd: string;
  created_at: string;
}

export const ARTICLES: Article[] = articlesData as Article[];

const bySlug = new Map(ARTICLES.map((a) => [a.slug, a]));

export function getArticle(slug: string): Article | undefined {
  return bySlug.get(slug);
}

export function getRelatedArticles(article: Article, count = 4): Article[] {
  // Simple related: same content type, different slug
  return ARTICLES.filter(
    (a) => a.slug !== article.slug && a.content_type === article.content_type
  ).slice(0, count);
}

export function getArticlesByType(type: Article["content_type"], limit = 20): Article[] {
  return ARTICLES.filter((a) => a.content_type === type).slice(0, limit);
}
