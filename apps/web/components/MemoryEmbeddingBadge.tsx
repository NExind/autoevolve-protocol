"use client";

/**
 * MemoryEmbeddingBadge — small status chip shown in the memory panel
 * when semantic (vector) ranking is active.
 *
 * The badge is displayed only when the /api/memory/search endpoint
 * returned cards that were ranked via query-time Gemini embeddings
 * (i.e., MEMORY_EMBEDDINGS_ENABLED=true). It never claims ranking
 * happened before a real API response confirms it.
 */

interface MemoryEmbeddingBadgeProps {
  /** True only when the server confirmed embedding-ranked results. */
  active: boolean;
  /** Total number of cards returned. */
  cardCount?: number;
}

export function MemoryEmbeddingBadge({
  active,
  cardCount,
}: MemoryEmbeddingBadgeProps) {
  if (!active) return null;

  return (
    <span
      className="embeddingBadge"
      title="Cards are ranked by cosine similarity to the task query using Gemini text embeddings computed at query time."
      aria-label="Semantic embedding ranking active"
    >
      <svg
        aria-hidden="true"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }}
      >
        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M3 6 L5.5 8.5 L9 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Semantic Ranking Active
      {cardCount !== undefined && (
        <span style={{ opacity: 0.75, marginLeft: 4 }}>({cardCount} cards)</span>
      )}
    </span>
  );
}
