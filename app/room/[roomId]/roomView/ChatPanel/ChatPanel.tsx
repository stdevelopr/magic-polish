"use client";

import { useState } from "react";
import type { ChatMessage } from "../../../../../media/core/MediaRoom";
import styles from "./ChatPanel.module.css";

type ChatPanelProps = {
  messages: ChatMessage[];
  onSend: (message: string) => void;
};

export default function ChatPanel({ messages, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const visibleMessages = messages.slice(-3);

  return (
    <div className={styles.chatPanel}>
      <div>
        <h3 style={{ marginTop: 0 }}>Class chat</h3>
        <p className="subtitle" style={{ marginBottom: 0 }}>
          Share links, ask questions, or post exercises.
        </p>
      </div>
      <div className={styles.chatMessages}>
        {visibleMessages.length === 0 ? (
          <p className="subtitle">No messages yet. Start the conversation.</p>
        ) : (
          visibleMessages.map((message) => (
            <div className={styles.chatMessage} key={message.id}>
              <strong>{message.participantName}</strong>
              <span>{message.message}</span>
            </div>
          ))
        )}
      </div>
      <form
        className="grid"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim()) {
            return;
          }
          onSend(draft.trim());
          setDraft("");
        }}
      >
        <input
          className="input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type a message"
        />
        <button className="button secondary" type="submit">
          Send message
        </button>
      </form>
    </div>
  );
}
