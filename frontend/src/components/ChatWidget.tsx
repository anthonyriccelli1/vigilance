import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Loader2, Bot, User } from "lucide-react";
import { theme } from "../theme";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "How many assets are active?",
  "Which assets need maintenance?",
  "What's the compliance rate?",
  "How many assets are in Zone C?",
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello. I'm the Vigilance AI assistant. Ask me anything about your facility assets and zones.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) throw new Error("Chat request failed");

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Connection error. Make sure the backend is running.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: theme.accent.primary,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 4px 24px ${theme.accent.primaryDim}`,
            zIndex: 1000,
            transition: "transform 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          <MessageSquare size={22} color="#fff" />
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            width: 380,
            height: 520,
            background: theme.bg.card,
            border: `1px solid ${theme.bg.border}`,
            borderRadius: 16,
            display: "flex",
            flexDirection: "column",
            zIndex: 1000,
            boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 16px",
              borderBottom: `1px solid ${theme.bg.border}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: theme.bg.sidebar,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  background: theme.accent.primaryDim,
                  borderRadius: 6,
                  padding: 5,
                  display: "flex",
                }}
              >
                <Bot size={16} color={theme.accent.primary} />
              </div>
              <div>
                <div style={{ color: theme.text.primary, fontSize: 14, fontWeight: 600 }}>
                  Vigilance AI
                </div>
                <div style={{ color: theme.accent.primary, fontSize: 11 }}>
                  ● Online
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "none",
                border: "none",
                color: theme.text.muted,
                cursor: "pointer",
                padding: 4,
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 8,
                  flexDirection: msg.role === "user" ? "row-reverse" : "row",
                  alignItems: "flex-start",
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: msg.role === "user" ? theme.accent.secondaryDim : theme.accent.primaryDim,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {msg.role === "user"
                    ? <User size={14} color={theme.accent.secondary} />
                    : <Bot size={14} color={theme.accent.primary} />
                  }
                </div>

                {/* Bubble */}
                <div
                  style={{
                    maxWidth: "75%",
                    padding: "8px 12px",
                    borderRadius: msg.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
                    background: msg.role === "user" ? theme.accent.secondaryDim : theme.bg.primary,
                    color: theme.text.primary,
                    fontSize: 13,
                    lineHeight: 1.5,
                    border: `1px solid ${msg.role === "user" ? theme.accent.secondary + "44" : theme.bg.border}`,
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: theme.accent.primaryDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Bot size={14} color={theme.accent.primary} />
                </div>
                <div style={{ padding: "8px 12px", background: theme.bg.primary, borderRadius: "4px 12px 12px 12px", border: `1px solid ${theme.bg.border}` }}>
                  <Loader2 size={14} color={theme.text.muted} style={{ animation: "spin 1s linear infinite" }} />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Suggested Questions (only show before any user messages) */}
          {messages.length === 1 && (
            <div style={{ padding: "0 12px 8px", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  style={{
                    padding: "4px 10px",
                    background: theme.bg.primary,
                    border: `1px solid ${theme.bg.border}`,
                    borderRadius: 12,
                    color: theme.text.secondary,
                    fontSize: 11,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = theme.accent.primary;
                    e.currentTarget.style.color = theme.accent.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = theme.bg.border;
                    e.currentTarget.style.color = theme.text.secondary;
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div
            style={{
              padding: 12,
              borderTop: `1px solid ${theme.bg.border}`,
              display: "flex",
              gap: 8,
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about assets or zones..."
              disabled={loading}
              style={{
                flex: 1,
                background: theme.bg.primary,
                border: `1px solid ${theme.bg.border}`,
                borderRadius: 8,
                padding: "8px 12px",
                color: theme.text.primary,
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              style={{
                background: input.trim() ? theme.accent.primary : theme.bg.border,
                border: "none",
                borderRadius: 8,
                padding: "8px 12px",
                cursor: input.trim() ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                transition: "background 0.15s",
              }}
            >
              <Send size={16} color="#fff" />
            </button>
          </div>
        </div>
      )}

      {/* Spin animation for loading */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
