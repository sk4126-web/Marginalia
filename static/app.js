document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements - Navigation & Sidebar
  const btnToggleSidebar = document.getElementById("btnToggleSidebar");
  const historySidebar = document.getElementById("historySidebar");
  const btnCloseSidebar = document.getElementById("btnCloseSidebar");
  const historyList = document.getElementById("historyList");
  const emptyHistoryNotice = document.getElementById("emptyHistoryNotice");
  const btnClearAllHistory = document.getElementById("btnClearAllHistory");
  const historyBadgeCount = document.getElementById("historyBadgeCount");
  const btnNewChatGlobal = document.getElementById("btnNewChatGlobal");
  const btnNewChatSidebar = document.getElementById("btnNewChatSidebar");

  // DOM Elements - Document Loading
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const docInfoCard = document.getElementById("docInfoCard");
  const docNameEl = document.getElementById("docName");
  const docMetaSubEl = document.getElementById("docMetaSub");
  const docTypeIcon = document.getElementById("docTypeIcon");
  const statChunksEl = document.getElementById("statChunks");
  const statSectionsEl = document.getElementById("statSections");
  const btnClearDoc = document.getElementById("btnClearDoc");
  const docTopicsSection = document.getElementById("docTopicsSection");
  const docTopicsList = document.getElementById("docTopicsList");

  const textInput = document.getElementById("textInput");
  const charCount = document.getElementById("charCount");
  const btnReadDoc = document.getElementById("btnReadDoc");
  const btnReadDocText = document.getElementById("btnReadDocText");
  const btnReadSpinner = document.getElementById("btnReadSpinner");
  const indexFeedback = document.getElementById("indexFeedback");

  // DOM Elements - Chat Area
  const chatActiveDocLabel = document.getElementById("chatActiveDocLabel");
  const indicatorDot = document.querySelector(".indicator-dot");
  const btnClearCurrentChat = document.getElementById("btnClearCurrentChat");
  const engineBadge = document.getElementById("engineBadge");
  const chatMessages = document.getElementById("chatMessages");
  const emptyState = document.getElementById("emptyState");
  const suggestedQueries = document.getElementById("suggestedQueries");
  const suggestedButtons = document.getElementById("suggestedButtons");
  const quickActionsBar = document.getElementById("quickActionsBar");
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const btnAsk = document.getElementById("btnAsk");

  // DOM Elements - Settings Modal
  const btnSettings = document.getElementById("btnSettings");
  const settingsModal = document.getElementById("settingsModal");
  const btnCloseModal = document.getElementById("btnCloseModal");
  const btnSaveSettings = document.getElementById("btnSaveSettings");
  const apiKeyGroup = document.getElementById("apiKeyGroup");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const apiKeyLabel = document.getElementById("apiKeyLabel");

  // State Management
  let currentSession = {
    id: null,
    docName: "",
    document: null,
    preview: "",
    topics: [],
    suggestedQuestions: [],
    messages: [] // Array of { sender, text, citations, provider, follow_ups }
  };

  let conversations = loadConversationsFromStorage();

  let currentSettings = {
    provider: localStorage.getItem("marginalia_provider") || "auto",
    apiKey: localStorage.getItem("marginalia_api_key") || ""
  };

  // --- Local Storage History Helpers ---
  function loadConversationsFromStorage() {
    try {
      const saved = localStorage.getItem("marginalia_conversations_v1");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  function saveConversationsToStorage() {
    try {
      localStorage.setItem("marginalia_conversations_v1", JSON.stringify(conversations));
      updateHistorySidebarUI();
    } catch (e) {
      console.warn("Storage quota error:", e);
    }
  }

  function formatTimeAgo(timestamp) {
    if (!timestamp) return "Recently";
    const diff = (Date.now() - timestamp) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function archiveCurrentConversationIfNotEmpty() {
    if (!currentSession.docName || currentSession.messages.length === 0) {
      return;
    }

    const existingIndex = conversations.findIndex(c => c.id === currentSession.id);
    const convoData = {
      id: currentSession.id,
      docName: currentSession.docName,
      document: currentSession.document,
      preview: currentSession.preview,
      topics: currentSession.topics || [],
      suggestedQuestions: currentSession.suggestedQuestions,
      messages: currentSession.messages,
      lastQuery: currentSession.messages.find(m => m.sender === "user")?.text || "Document Q&A",
      timestamp: Date.now()
    };

    if (existingIndex >= 0) {
      conversations[existingIndex] = convoData;
    } else {
      conversations.unshift(convoData);
    }

    saveConversationsToStorage();
  }

  function updateHistorySidebarUI() {
    historyBadgeCount.textContent = conversations.length;
    btnClearAllHistory.disabled = conversations.length === 0;

    if (conversations.length === 0) {
      emptyHistoryNotice.classList.remove("hidden");
      historyList.querySelectorAll(".history-card").forEach(el => el.remove());
      return;
    }

    emptyHistoryNotice.classList.add("hidden");
    historyList.querySelectorAll(".history-card").forEach(el => el.remove());

    conversations.forEach(convo => {
      const card = document.createElement("div");
      card.className = "history-card";
      if (currentSession.id === convo.id) {
        card.classList.add("active");
      }

      const content = document.createElement("div");
      content.className = "history-card-content";

      const title = document.createElement("div");
      title.className = "history-card-title";
      title.innerHTML = `<span>${getFileIcon(convo.docName)}</span> <span>${convo.docName}</span>`;

      const sub = document.createElement("div");
      sub.className = "history-card-sub";
      sub.textContent = `${convo.messages.length} msgs • ${formatTimeAgo(convo.timestamp)}`;

      content.appendChild(title);
      content.appendChild(sub);

      const btnDelete = document.createElement("button");
      btnDelete.className = "btn-delete-history";
      btnDelete.title = "Delete conversation";
      btnDelete.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
      
      btnDelete.addEventListener("click", (e) => {
        e.stopPropagation();
        conversations = conversations.filter(c => c.id !== convo.id);
        saveConversationsToStorage();
        if (currentSession.id === convo.id) {
          startNewChat(false);
        }
      });

      card.appendChild(content);
      card.appendChild(btnDelete);

      card.addEventListener("click", () => {
        loadConversation(convo);
        if (window.innerWidth < 1024) {
          historySidebar.classList.remove("open");
        }
      });

      historyList.appendChild(card);
    });
  }

  function loadConversation(convo) {
    archiveCurrentConversationIfNotEmpty();

    currentSession = {
      id: convo.id,
      docName: convo.docName,
      document: convo.document,
      preview: convo.preview,
      topics: convo.topics || [],
      suggestedQuestions: convo.suggestedQuestions || [],
      messages: convo.messages || []
    };

    renderDocumentInfo(currentSession.document, currentSession.preview, currentSession.topics);
    renderMessageHistory(currentSession.messages);
    updateHistorySidebarUI();
  }

  function startNewChat(savePrevious = true) {
    if (savePrevious) {
      archiveCurrentConversationIfNotEmpty();
    }

    currentSession = {
      id: "session_" + Math.random().toString(36).substring(2, 10),
      docName: "",
      document: null,
      preview: "",
      topics: [],
      suggestedQuestions: [],
      messages: []
    };

    // Reset Document Pane
    docInfoCard.classList.add("hidden");
    docTopicsSection.classList.add("hidden");
    dropzone.classList.remove("hidden");
    fileInput.value = "";
    textInput.value = "";
    charCount.textContent = "0 / 100,000 characters";
    btnReadDoc.disabled = true;

    // Reset Chat Pane
    chatActiveDocLabel.textContent = "No document loaded yet";
    indicatorDot.classList.remove("active");
    chatInput.disabled = true;
    chatInput.value = "";
    chatInput.placeholder = "Upload a document to start asking...";
    btnAsk.disabled = true;
    quickActionsBar.classList.add("hidden");

    chatMessages.querySelectorAll(".message-row").forEach(el => el.remove());
    emptyState.classList.remove("hidden");
    suggestedQueries.classList.add("hidden");

    updateHistorySidebarUI();
  }

  // --- Clear History & Reset ---
  btnClearCurrentChat.addEventListener("click", () => {
    if (currentSession.messages.length === 0 && !currentSession.docName) return;

    if (confirm("Clear current question thread for this document?")) {
      currentSession.messages = [];
      chatMessages.querySelectorAll(".message-row").forEach(el => el.remove());
      emptyState.classList.remove("hidden");

      if (currentSession.suggestedQuestions && currentSession.suggestedQuestions.length > 0) {
        suggestedQueries.classList.remove("hidden");
      }

      chatInput.value = "";
      chatInput.focus();

      const existing = conversations.find(c => c.id === currentSession.id);
      if (existing) {
        existing.messages = [];
        saveConversationsToStorage();
      }
    }
  });

  btnClearAllHistory.addEventListener("click", () => {
    if (confirm("Delete all saved conversations from history?")) {
      conversations = [];
      saveConversationsToStorage();
    }
  });

  btnToggleSidebar.addEventListener("click", () => {
    historySidebar.classList.toggle("open");
  });

  btnCloseSidebar.addEventListener("click", () => {
    historySidebar.classList.remove("open");
  });

  btnNewChatGlobal.addEventListener("click", () => startNewChat(true));
  btnNewChatSidebar.addEventListener("click", () => {
    startNewChat(true);
    historySidebar.classList.remove("open");
  });

  // --- Quick Actions Bar Listeners ---
  document.querySelectorAll(".btn-quick-action").forEach(btn => {
    btn.addEventListener("click", () => {
      const prompt = btn.getAttribute("data-prompt");
      if (prompt && currentSession.docName) {
        chatInput.value = prompt;
        submitQuestion();
      }
    });
  });

  // --- Settings UI ---
  function updateSettingsUI() {
    const radio = document.querySelector(`input[name="engineProvider"][value="${currentSettings.provider}"]`);
    if (radio) radio.checked = true;

    if (currentSettings.provider === "gemini") {
      apiKeyGroup.classList.remove("hidden");
      apiKeyLabel.textContent = "Google Gemini API Key:";
      apiKeyInput.value = currentSettings.apiKey;
      engineBadge.textContent = "Gemini 2.5 Flash";
    } else if (currentSettings.provider === "openai") {
      apiKeyGroup.classList.remove("hidden");
      apiKeyLabel.textContent = "OpenAI API Key:";
      apiKeyInput.value = currentSettings.apiKey;
      engineBadge.textContent = "OpenAI GPT-4o-mini";
    } else {
      apiKeyGroup.classList.add("hidden");
      engineBadge.textContent = "Local Synthesizer (Free)";
    }
  }
  updateSettingsUI();

  btnSettings.addEventListener("click", () => {
    updateSettingsUI();
    settingsModal.classList.remove("hidden");
  });

  btnCloseModal.addEventListener("click", () => {
    settingsModal.classList.add("hidden");
  });

  document.querySelectorAll('input[name="engineProvider"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val === "auto") {
        apiKeyGroup.classList.add("hidden");
      } else {
        apiKeyGroup.classList.remove("hidden");
        apiKeyLabel.textContent = val === "gemini" ? "Google Gemini API Key:" : "OpenAI API Key:";
      }
    });
  });

  btnSaveSettings.addEventListener("click", () => {
    const selectedProvider = document.querySelector('input[name="engineProvider"]:checked').value;
    currentSettings.provider = selectedProvider;
    currentSettings.apiKey = apiKeyInput.value.trim();

    localStorage.setItem("marginalia_provider", currentSettings.provider);
    localStorage.setItem("marginalia_api_key", currentSettings.apiKey);

    updateSettingsUI();
    settingsModal.classList.add("hidden");
  });

  // Character counter for textarea
  textInput.addEventListener("input", () => {
    const len = textInput.value.length;
    charCount.textContent = `${len.toLocaleString()} / 100,000 characters`;
    if (!currentSession.document) {
      btnReadDoc.disabled = len === 0;
    }
  });

  // Drag and Drop
  ["dragenter", "dragover"].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove("dragover");
    });
  });

  dropzone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      uploadFile(e.target.files[0]);
    }
  });

  function getFileIcon(filename) {
    if (!filename) return "📄";
    const ext = filename.split(".").pop().toLowerCase();
    if (ext === "pdf") return "📕";
    if (["docx", "doc"].includes(ext)) return "📘";
    if (["xlsx", "xlsm", "xls"].includes(ext)) return "📗";
    if (ext === "csv") return "📊";
    return "📄";
  }

  // Upload File API
  async function uploadFile(file) {
    archiveCurrentConversationIfNotEmpty();

    setLoading(true, `Reading ${file.name}…`);
    const newSessionId = "session_" + Math.random().toString(36).substring(2, 10);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("session_id", newSessionId);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Upload failed");
      }

      handleDocumentLoaded(data, newSessionId);
    } catch (err) {
      alert("Error parsing document: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Paste Text API
  btnReadDoc.addEventListener("click", async () => {
    const text = textInput.value.trim();
    if (!text) return;

    archiveCurrentConversationIfNotEmpty();

    setLoading(true, "Reading document…");
    const newSessionId = "session_" + Math.random().toString(36).substring(2, 10);

    try {
      const res = await fetch("/api/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          title: "Pasted Text Document",
          session_id: newSessionId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to process text");
      }

      handleDocumentLoaded(data, newSessionId);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  });

  function handleDocumentLoaded(data, sessionId) {
    chatMessages.querySelectorAll(".message-row").forEach(el => el.remove());

    const topics = data.document.topics || [];

    currentSession = {
      id: sessionId || data.session_id,
      docName: data.document.name,
      document: data.document,
      preview: data.preview,
      topics: topics,
      suggestedQuestions: data.suggested_questions || [],
      messages: []
    };

    renderDocumentInfo(data.document, data.preview, topics);
    renderMessageHistory([]);

    indexFeedback.textContent = `✓ Indexed ${data.document.total_chunks} passage chunks`;
    setTimeout(() => { indexFeedback.textContent = ""; }, 4000);

    updateHistorySidebarUI();
  }

  function renderDocumentInfo(doc, preview, topics = []) {
    if (!doc) return;
    docNameEl.textContent = doc.name;
    docTypeIcon.textContent = getFileIcon(doc.name);

    const meta = doc.metadata || {};
    const typeLabel = meta.type || "Document";
    const pagesLabel = meta.page_count ? `${meta.page_count} Pages • ` : (meta.sheet_count ? `${meta.sheet_count} Sheets • ` : "");
    docMetaSubEl.textContent = `${typeLabel} • ${pagesLabel}${(doc.char_count || 0).toLocaleString()} characters`;

    statChunksEl.textContent = doc.total_chunks || "1";
    statSectionsEl.textContent = meta.page_count || meta.sheet_count || meta.paragraph_count || "1";

    // Render Detected Topics Pills
    if (topics && topics.length > 0) {
      docTopicsList.innerHTML = "";
      topics.forEach(t => {
        const pill = document.createElement("button");
        pill.className = "doc-topic-pill";
        pill.innerHTML = `<span>📌</span> ${t.topic}`;
        pill.title = `Ask about ${t.topic}`;
        pill.addEventListener("click", () => {
          chatInput.value = `Summarize everything the document covers regarding "${t.topic}".`;
          submitQuestion();
        });
        docTopicsList.appendChild(pill);
      });
      docTopicsSection.classList.remove("hidden");
    } else {
      docTopicsSection.classList.add("hidden");
    }

    docInfoCard.classList.remove("hidden");
    dropzone.classList.add("hidden");

    if (preview) {
      textInput.value = preview;
      charCount.textContent = `${preview.length.toLocaleString()} / 100,000 characters`;
    }

    chatActiveDocLabel.textContent = doc.name;
    indicatorDot.classList.add("active");
    chatInput.disabled = false;
    chatInput.placeholder = `Ask anything about ${doc.name}…`;
    btnAsk.disabled = false;
    btnReadDoc.disabled = true;

    // Show Quick Action Bar
    quickActionsBar.classList.remove("hidden");

    // Starter suggestions
    if (currentSession.suggestedQuestions && currentSession.suggestedQuestions.length > 0) {
      suggestedButtons.innerHTML = "";
      currentSession.suggestedQuestions.forEach(q => {
        const btn = document.createElement("button");
        btn.className = "btn-suggested";
        btn.textContent = q;
        btn.addEventListener("click", () => {
          chatInput.value = q;
          submitQuestion();
        });
        suggestedButtons.appendChild(btn);
      });
      suggestedQueries.classList.remove("hidden");
    }
  }

  function renderMessageHistory(messages) {
    chatMessages.querySelectorAll(".message-row").forEach(el => el.remove());

    if (!messages || messages.length === 0) {
      emptyState.classList.remove("hidden");
      return;
    }

    emptyState.classList.add("hidden");
    messages.forEach(msg => {
      if (msg.sender === "user") {
        appendMessage("user", msg.text);
      } else {
        appendAssistantMessage(msg.text, msg.citations, msg.provider, msg.follow_ups);
      }
    });
  }

  btnClearDoc.addEventListener("click", () => {
    startNewChat(true);
  });

  function setLoading(loading, text = "Reading document") {
    if (loading) {
      btnReadDoc.disabled = true;
      btnReadDocText.textContent = text;
      btnReadSpinner.classList.remove("hidden");
    } else {
      btnReadDoc.disabled = false;
      btnReadDocText.textContent = "Read document";
      btnReadSpinner.classList.add("hidden");
    }
  }

  // Chat Form Handling
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    submitQuestion();
  });

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitQuestion();
    }
  });

  async function submitQuestion() {
    const query = chatInput.value.trim();
    if (!query || !currentSession.docName) return;

    emptyState.classList.add("hidden");

    appendMessage("user", query);
    currentSession.messages.push({ sender: "user", text: query });
    saveConversationsToStorage();

    chatInput.value = "";
    chatInput.disabled = true;
    btnAsk.disabled = true;

    const loadingRow = appendMessage("assistant", "Analyzing document, synthesizing answer, and extracting topics…", true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          session_id: currentSession.id,
          api_key: currentSettings.apiKey || null,
          provider: currentSettings.provider
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Query failed");
      }

      loadingRow.remove();
      appendAssistantMessage(data.answer, data.citations, data.provider, data.follow_ups);

      currentSession.messages.push({
        sender: "assistant",
        text: data.answer,
        citations: data.citations || [],
        provider: data.provider || "",
        follow_ups: data.follow_ups || []
      });

      saveConversationsToStorage();
    } catch (err) {
      loadingRow.remove();
      appendMessage("assistant", "⚠️ " + err.message);
    } finally {
      chatInput.disabled = false;
      btnAsk.disabled = false;
      chatInput.focus();
    }
  }

  function appendMessage(sender, text, isLoading = false) {
    const row = document.createElement("div");
    row.className = `message-row ${sender}`;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.innerHTML = formatMarkdown(text);

    if (isLoading) {
      bubble.style.fontStyle = "italic";
      bubble.style.color = "var(--ink-muted)";
    }

    row.appendChild(bubble);
    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return row;
  }

  function appendAssistantMessage(answer, citations = [], provider = "", follow_ups = []) {
    const row = document.createElement("div");
    row.className = "message-row assistant";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.innerHTML = formatMarkdown(answer);
    row.appendChild(bubble);

    // Citations
    if (citations && citations.length > 0) {
      const citationsWrapper = document.createElement("div");
      citationsWrapper.className = "citations-wrapper";

      const header = document.createElement("div");
      header.className = "citations-header";
      header.textContent = `Cited Passages (${citations.length}):`;
      citationsWrapper.appendChild(header);

      const chipsContainer = document.createElement("div");
      chipsContainer.className = "citations-chips";

      const detailBox = document.createElement("div");
      detailBox.className = "citation-detail-box hidden";

      citations.forEach((c) => {
        const chip = document.createElement("button");
        chip.className = "citation-chip";
        chip.innerHTML = `<span>🔖</span> ${c.source_ref} <span style="font-size:0.65rem; opacity:0.75">#${c.id}</span>`;
        
        chip.addEventListener("click", () => {
          const isCurrentActive = chip.classList.contains("active");
          chipsContainer.querySelectorAll(".citation-chip").forEach(ch => ch.classList.remove("active"));

          if (isCurrentActive) {
            detailBox.classList.add("hidden");
          } else {
            chip.classList.add("active");
            detailBox.textContent = `[Passage from ${c.source_ref}]:\n\n${c.text}`;
            detailBox.classList.remove("hidden");
          }
          chatMessages.scrollTop = chatMessages.scrollHeight;
        });

        chipsContainer.appendChild(chip);
      });

      citationsWrapper.appendChild(chipsContainer);
      citationsWrapper.appendChild(detailBox);
      row.appendChild(citationsWrapper);
    }

    // Interactive Follow-up Prompt Chips
    if (follow_ups && follow_ups.length > 0) {
      const fContainer = document.createElement("div");
      fContainer.className = "follow-ups-container";

      const fLabel = document.createElement("span");
      fLabel.className = "follow-ups-label";
      fLabel.textContent = "Suggested follow-ups:";
      fContainer.appendChild(fLabel);

      const fList = document.createElement("div");
      fList.className = "follow-ups-list";

      follow_ups.forEach(q => {
        const fBtn = document.createElement("button");
        fBtn.className = "btn-follow-up";
        fBtn.innerHTML = `<span>💬</span> ${q}`;
        fBtn.addEventListener("click", () => {
          chatInput.value = q;
          submitQuestion();
        });
        fList.appendChild(fBtn);
      });

      fContainer.appendChild(fList);
      row.appendChild(fContainer);
    }

    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function formatMarkdown(str) {
    if (!str) return "";
    let html = str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Headers
    html = html.replace(/^###\s*(.+)$/gm, "<h3 style='margin-top:0.6rem; margin-bottom:0.3rem; font-size:1.05rem; font-weight:700;'>$1</h3>");
    html = html.replace(/^####\s*(.+)$/gm, "<h4 style='margin-top:0.5rem; margin-bottom:0.25rem; font-size:0.92rem; font-weight:700;'>$1</h4>");

    // Blockquotes
    html = html.replace(/^>\s*(.+)$/gm, "<blockquote>$1</blockquote>");

    // Unordered lists
    html = html.replace(/^\*\s*(.+)$/gm, "<li style='margin-left:1.2rem; margin-bottom:0.2rem;'>$1</li>");

    // Inline code
    html = html.replace(/`([^`]+)`/g, "<code style='background:rgba(0,0,0,0.06); padding:2px 5px; border-radius:4px; font-family:var(--font-mono); font-size:0.85em;'>$1</code>");

    // Bold & Italics
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // Paragraph breaks
    html = html.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br/>");

    return `<p>${html}</p>`;
  }

  // Initialize
  updateHistorySidebarUI();
  startNewChat(false);
});
