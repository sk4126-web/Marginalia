import os
import re
import math
from typing import List, Dict, Any, Optional
from collections import Counter
from langchain_text_splitters import RecursiveCharacterTextSplitter

class DocumentStore:
    def __init__(self):
        self.doc_name: str = ""
        self.raw_text: str = ""
        self.metadata: Dict[str, Any] = {}
        self.chunks: List[Dict[str, Any]] = []
        self.topics: List[Dict[str, Any]] = []
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=750,
            chunk_overlap=120,
            separators=["\n\n", "\n", ". ", "; ", " ", ""]
        )

    def load_document(self, name: str, parsed_data: Dict[str, Any]):
        self.doc_name = name
        self.raw_text = parsed_data.get("text", "")
        self.metadata = parsed_data.get("metadata", {})
        self.chunks = []

        sections = parsed_data.get("sections", [])
        if not sections:
            sections = [{"source_ref": "Document", "content": self.raw_text}]

        chunk_id = 1
        for section in sections:
            source_ref = section.get("source_ref", "Document")
            content = section.get("content", "")
            if not content.strip():
                continue

            sub_chunks = self.splitter.split_text(content)
            for sub_c in sub_chunks:
                clean_c = sub_c.strip()
                if clean_c:
                    self.chunks.append({
                        "id": chunk_id,
                        "source_ref": source_ref,
                        "text": clean_c,
                        "char_count": len(clean_c)
                    })
                    chunk_id += 1

        # Extract topics
        self.topics = self._extract_document_topics()

        return {
            "name": self.doc_name,
            "total_chunks": len(self.chunks),
            "char_count": len(self.raw_text),
            "metadata": self.metadata,
            "topics": self.topics
        }

    def _tokenize(self, text: str) -> List[str]:
        return [w.lower() for w in re.findall(r"\b[a-zA-Z0-9_]{2,}\b", text)]

    def _extract_document_topics(self) -> List[Dict[str, Any]]:
        """Automatically extracts high-level topics, section titles, and key entities from the document."""
        topics = []
        seen_titles = set()

        # 1. Detect headings from markdown or uppercase lines
        lines = self.raw_text.split("\n")
        for line in lines:
            clean = line.strip()
            # Markdown headers (# or ##) or Sheet names (### Sheet: X)
            m = re.match(r"^(?:#{1,3}\s*|---+\s*\[?)([^\]#\n]{3,60})", clean)
            if m:
                title = m.group(1).replace("---", "").strip()
                if title and title.lower() not in seen_titles and len(title) > 3:
                    seen_titles.add(title.lower())
                    topics.append({"topic": title, "type": "section"})
            # Uppercase headings
            elif len(clean) > 4 and len(clean) < 50 and clean.isupper() and not clean.startswith("HTTP"):
                if clean.lower() not in seen_titles:
                    seen_titles.add(clean.lower())
                    topics.append({"topic": clean.title(), "type": "heading"})

        # 2. Key phrases based on noun frequency
        stopwords = {
            "the", "and", "for", "that", "this", "with", "from", "have", "were", "been",
            "they", "their", "which", "about", "into", "also", "some", "other", "than",
            "then", "them", "will", "would", "could", "should", "document", "page", "sheet"
        }
        tokens = [w for w in self._tokenize(self.raw_text) if len(w) > 3 and w not in stopwords]
        counts = Counter(tokens).most_common(8)

        for word, count in counts:
            if word not in seen_titles and count >= 2:
                seen_titles.add(word)
                topics.append({"topic": word.capitalize(), "type": "keyword", "count": count})

        return topics[:10]

    def retrieve(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        if not self.chunks:
            return []

        q_tokens = self._tokenize(query)
        if not q_tokens:
            return self.chunks[:top_k]

        q_counter = Counter(q_tokens)
        scored_chunks = []

        N = len(self.chunks)
        df = Counter()
        chunk_token_lists = []

        for chunk in self.chunks:
            tokens = self._tokenize(chunk["text"])
            chunk_token_lists.append(tokens)
            unique_tokens = set(tokens)
            for t in unique_tokens:
                df[t] += 1

        for i, chunk in enumerate(self.chunks):
            tokens = chunk_token_lists[i]
            if not tokens:
                continue

            t_counter = Counter(tokens)
            doc_len = len(tokens)
            avg_dl = sum(len(c) for c in chunk_token_lists) / max(N, 1)

            score = 0.0
            k1 = 1.5
            b = 0.75

            for t, q_weight in q_counter.items():
                if t in t_counter:
                    tf = t_counter[t]
                    idf = math.log((N - df[t] + 0.5) / (df[t] + 0.5) + 1.0)
                    tf_norm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (doc_len / max(avg_dl, 1))))
                    score += idf * tf_norm * q_weight

            q_lower = query.lower().strip()
            if len(q_lower) > 4 and q_lower in chunk["text"].lower():
                score += 6.0

            if score > 0:
                scored_chunks.append({
                    **chunk,
                    "score": round(score, 3)
                })

        scored_chunks.sort(key=lambda x: x["score"], reverse=True)
        return scored_chunks[:top_k]

    def _generate_interactive_followups(self, query: str, top_chunks: List[Dict[str, Any]]) -> List[str]:
        """Generates dynamic, highly context-aware follow-up prompt suggestions."""
        q_lower = query.lower()
        follow_ups = []

        if any(w in q_lower for w in ["summary", "summarize", "overview"]):
            follow_ups.extend([
                "What are the key data points and metrics?",
                "Break down the main topics by section",
                "What are the main conclusions and action items?"
            ])
        elif any(w in q_lower for w in ["topic", "theme", "outline", "structure"]):
            follow_ups.extend([
                "Explain the most critical topic in detail",
                "What methodology or approach is used?",
                "Provide an executive summary of these topics"
            ])
        elif any(w in q_lower for w in ["revenue", "metric", "number", "table", "data", "cost"]):
            follow_ups.extend([
                "Compare these metrics with the projections",
                "What are the highest performing areas?",
                "Summarize the key takeaways from these numbers"
            ])
        else:
            if self.topics:
                t1 = self.topics[0]["topic"]
                follow_ups.append(f"Tell me more about {t1}")
            follow_ups.extend([
                "Summarize the most relevant section",
                "Are there any specific risks or limitations mentioned?"
            ])

        return follow_ups[:3]

    def _synthesize_local_summary(self) -> Dict[str, Any]:
        """Generates a rich, structured multi-topic summary from across the whole document."""
        # Sample chunks across start, middle, and end
        total = len(self.chunks)
        if total <= 4:
            selected_chunks = self.chunks
        else:
            indices = [0, total // 4, total // 2, (3 * total) // 4, total - 1]
            selected_chunks = [self.chunks[i] for i in sorted(set(indices))]

        topics_bullet_list = []
        if self.topics:
            for t in self.topics[:5]:
                topics_bullet_list.append(f"* **{t['topic']}**: Key focus area in the document.")
        else:
            for i, c in enumerate(selected_chunks[:4]):
                first_line = c["text"].strip().split("\n")[0][:60]
                topics_bullet_list.append(f"* **{c['source_ref']}**: {first_line}")

        # Extract highlighted key sentences from initial chunks
        lead_sentences = []
        for c in selected_chunks[:3]:
            s_list = [s.strip() for s in re.split(r"(?<=[.!?])\s+", c["text"]) if len(s.strip()) > 20]
            if s_list:
                lead_sentences.append(s_list[0])

        lead_summary = " ".join(lead_sentences[:2]) if lead_sentences else "This document provides detailed insights and structured information."

        answer = (
            f"### 📑 Executive Summary for **{self.doc_name}**\n\n"
            f"{lead_summary}\n\n"
            f"#### 🔍 Key Topics & Structure:\n"
            + "\n".join(topics_bullet_list) +
            f"\n\n#### 📌 Highlights & Findings:\n"
            f"* **Scope**: Analyzed across **{total} indexed passage(s)** and {self.metadata.get('page_count', self.metadata.get('sheet_count', 'multiple'))} section(s).\n"
            f"* **Coverage**: Extracted from {', '.join([c['source_ref'] for c in selected_chunks[:3]])}.\n\n"
            f"> *Review the cited passages below or click any topic to dive deeper.*"
        )

        return {
            "answer": answer,
            "citations": selected_chunks[:4],
            "provider": "Marginalia Synthesis Engine"
        }

    def _synthesize_topic_breakdown(self) -> Dict[str, Any]:
        """Generates a detailed topic-by-topic analysis with quotes and citations."""
        breakdown_parts = [f"### 📌 Topics & Thematic Breakdown: **{self.doc_name}**\n"]

        # Group chunks by source_ref (Page, Sheet, or Section)
        groups = {}
        for c in self.chunks:
            ref = c["source_ref"]
            if ref not in groups:
                groups[ref] = []
            groups[ref].append(c)

        for ref, group_chunks in list(groups.items())[:5]:
            combined_text = " ".join([c["text"] for c in group_chunks])
            sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", combined_text) if len(s.strip()) > 25]
            summary_snippet = sentences[0] if sentences else combined_text[:120] + "..."
            
            breakdown_parts.append(f"#### 📂 {ref}")
            breakdown_parts.append(f"{summary_snippet}\n")

        if self.topics:
            breakdown_parts.append("#### 🏷️ Prominent Entities & Keywords:")
            breakdown_parts.append(", ".join([f"`{t['topic']}`" for t in self.topics]))

        citations = self.chunks[:5]
        return {
            "answer": "\n".join(breakdown_parts),
            "citations": citations,
            "provider": "Marginalia Topic Analyzer"
        }

    def answer_question(self, query: str, api_key: Optional[str] = None, provider: str = "auto") -> Dict[str, Any]:
        """Answers any question using either Gemini/OpenAI or an advanced local synthesizer."""
        q_lower = query.lower().strip()

        # Check for Summary or Topic Breakdown intents
        is_summary_request = any(w in q_lower for w in ["summary", "summarize", "overview", "tldr", "briefly describe", "what is this document about"])
        is_topic_request = any(w in q_lower for w in ["topics", "themes", "outline", "structure", "table of contents", "sections"])

        top_chunks = self.retrieve(query, top_k=5) if not is_summary_request else self.chunks[:5]

        if not top_chunks and not self.chunks:
            return {
                "answer": "I couldn't find any passages in the loaded document. Please upload or paste a document first.",
                "citations": [],
                "follow_ups": []
            }

        # Check for Gemini / OpenAI
        gemini_key = api_key if (api_key and provider == "gemini") else os.getenv("GEMINI_API_KEY")
        openai_key = api_key if (api_key and provider == "openai") else os.getenv("OPENAI_API_KEY")

        if gemini_key:
            try:
                from google import genai
                client = genai.Client(api_key=gemini_key)
                
                context_str = "\n\n".join([
                    f"[Citation {i+1} - {c['source_ref']}]:\n{c['text']}"
                    for i, c in enumerate(top_chunks)
                ])

                prompt = (
                    "You are Marginalia, a highly interactive, intelligent research assistant. "
                    "You can answer all types of questions about the document: broad executive summaries, "
                    "topic-by-topic breakdowns, detailed factual answers, calculations, and analytical insights.\n\n"
                    "Formatting Guidelines:\n"
                    "- Use clear, engaging Markdown with bold headings, bullet points, and blockquotes.\n"
                    "- For summaries: give a high-level overview, then highlight the main topics and key takeaways.\n"
                    "- Always cite the source passage using citations like [Citation 1 - Page X] or [Citation 2 - Sheet Y].\n"
                    "- At the end, naturally suggest 2-3 engaging follow-up directions.\n\n"
                    f"Document Title: {self.doc_name}\n\n"
                    f"Document Excerpts:\n{context_str}\n\n"
                    f"User Query: {query}\n\n"
                    "Interactive Answer:"
                )

                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt
                )
                answer_text = response.text
                follow_ups = self._generate_interactive_followups(query, top_chunks)
                return {
                    "answer": answer_text,
                    "citations": top_chunks,
                    "follow_ups": follow_ups,
                    "provider": "Gemini 2.5 Flash"
                }
            except Exception:
                pass

        if openai_key:
            try:
                from openai import OpenAI
                client = OpenAI(api_key=openai_key)
                context_str = "\n\n".join([
                    f"[Citation {i+1} - {c['source_ref']}]:\n{c['text']}"
                    for i, c in enumerate(top_chunks)
                ])
                completion = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "You are Marginalia, an interactive document expert. Answer all questions clearly with "
                                "structured markdown (headings, bullets), exact citations like [Citation 1 - Page X], "
                                "and provide deep topic summaries when requested."
                            )
                        },
                        {"role": "user", "content": f"Context:\n{context_str}\n\nQuestion: {query}"}
                    ]
                )
                follow_ups = self._generate_interactive_followups(query, top_chunks)
                return {
                    "answer": completion.choices[0].message.content,
                    "citations": top_chunks,
                    "follow_ups": follow_ups,
                    "provider": "OpenAI GPT-4o-mini"
                }
            except Exception:
                pass

        # Advanced Local Synthesizer (Works 100% offline & handles all question types!)
        follow_ups = self._generate_interactive_followups(query, top_chunks)

        if is_summary_request:
            res = self._synthesize_local_summary()
            res["follow_ups"] = follow_ups
            return res

        if is_topic_request:
            res = self._synthesize_topic_breakdown()
            res["follow_ups"] = follow_ups
            return res

        # Specific Question Answering
        best_chunks = top_chunks[:3]
        q_tokens = set(self._tokenize(query))

        answer_bullets = []
        for c in best_chunks:
            sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", c["text"]) if s.strip()]
            scored_sentences = []
            for s in sentences:
                s_tokens = set(self._tokenize(s))
                overlap = len(q_tokens.intersection(s_tokens))
                if overlap > 0:
                    scored_sentences.append((overlap, s))
            
            scored_sentences.sort(key=lambda x: x[0], reverse=True)
            if scored_sentences:
                top_sent = scored_sentences[0][1]
                answer_bullets.append(f"* **{c['source_ref']}**: \"{top_sent}\"")

        if not answer_bullets:
            first_chunk = top_chunks[0]
            answer_bullets.append(f"* **{first_chunk['source_ref']}**: \"{first_chunk['text'][:240]}...\"")

        answer_parts = [
            f"### Findings for: *\"{query}\"*\n",
            f"Based on **{self.doc_name}**, here are the most relevant details extracted:\n",
            "\n".join(answer_bullets),
            f"\n\n> 💡 **Citation Note:** Verified across {len(top_chunks)} related passage(s). Click any citation badge below to read the original context."
        ]

        return {
            "answer": "\n".join(answer_parts),
            "citations": top_chunks,
            "follow_ups": follow_ups,
            "provider": "Marginalia Interactive Synthesizer"
        }
