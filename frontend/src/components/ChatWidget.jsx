/**
 * Chat Widget - Botão flutuante para iniciar conversa com IA
 * Aparece fixo no canto inferior direito da tela
 * Usa o sistema de IA do EstoqueUni
 */
import { useState, useEffect, useContext } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { AuthContext } from "../context/AuthContext";
import { chatAPI } from "./ChatWidget/chatAPI.js";
import "./ChatWidget.css";

export default function ChatWidget() {
  const { tenantId } = useTenant();
  const { user } = useContext(AuthContext);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);

  // Auto-scroll ao adicionar mensagens
  useEffect(() => {
    const messagesContainer = document.querySelector(".chat-widget-messages");
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }, [messages]);

  // Mensagem de boas-vindas inicial
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          text: "Olá! Sou o assistente virtual do EstoqueUni. Como posso ajudar você hoje?",
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!inputMessage.trim() || isLoading) return;

    if (!tenantId) {
      const errorMessage = {
        id: `error_${Date.now()}`,
        text: "Erro: Você precisa estar autenticado para usar o chat. Faça login novamente.",
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    const messageText = inputMessage;

    // Adiciona mensagem do usuário localmente
    const userMessage = {
      id: `user_${Date.now()}`,
      text: messageText,
      sender: "visitor",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      // Envia mensagem para a API do backend-ai
      const response = await chatAPI.sendMessage(
        messageText,
        conversationId,
        false,
        tenantId,
        user?.id
      );

      // A resposta do chatAPI já é response.data do axios
      const responseData = response?.data || response;

      if (!responseData) {
        throw new Error("Resposta vazia da API");
      }

      // Verifica se há erro na resposta
      if (responseData.error || responseData.success === false) {
        throw new Error(responseData.error || responseData.message || "Erro na resposta da API");
      }

      // Adiciona resposta da IA
      const answerText = responseData.answer || responseData.content || responseData.message;

      if (!answerText) {
        throw new Error("Resposta da IA não contém texto");
      }

      const assistantMessage = {
        id: responseData.messageId || responseData.id || `ai_${Date.now()}`,
        text: answerText,
        sender: "bot",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Atualiza conversationId se for uma nova conversa
      if (responseData.conversationId && !conversationId) {
        setConversationId(responseData.conversationId);
      }
    } catch (error) {
      console.error("[ChatWidget] Erro ao enviar mensagem:", error);

      let errorText = "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.";

      if (error.response?.data?.message) {
        errorText = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorText = error.response.data.error;
      } else if (error.message) {
        errorText = error.message;
      }

      const errorMessage = {
        id: `error_${Date.now()}`,
        text: errorText,
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setInputMessage("");
  };

  return (
    <div className={`chat-widget-container ${isOpen ? "open" : ""}`}>
      {/* Janela do Chat */}
      {isOpen && (
        <div className="chat-widget-window">
          {/* Header */}
          <div className="chat-widget-header">
            <div>
              <h4>🤖 Assistente Virtual</h4>
              <p className="chat-status">🟢 Online</p>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {messages.length > 1 && (
                <button
                  onClick={handleNewConversation}
                  className="chat-end-btn"
                  title="Nova conversa">
                  Nova
                </button>
              )}
              <button onClick={handleToggle} className="chat-close-btn">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Mensagens */}
          <div className="chat-widget-messages">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-message ${
                  msg.sender === "visitor" ? "visitor" : "bot"
                }`}>
                <p>{msg.text}</p>
                <span className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
            {isLoading && (
              <div className="chat-message bot">
                <p>Digitando...</p>
              </div>
            )}
          </div>

          {/* Input de mensagem */}
          <form onSubmit={handleSendMessage} className="chat-widget-input">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              disabled={isLoading}
            />
            <button type="submit" disabled={!inputMessage.trim() || isLoading}>
              <Send size={20} />
            </button>
          </form>
        </div>
      )}

      {/* Botão principal */}
      <button
        className={`chat-widget-button ${isOpen ? "active" : ""}`}
        onClick={handleToggle}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        aria-label="Abrir chat"
        type="button">
        <span style={{ pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isOpen ? <X size={28} /> : <MessageCircle size={28} />}
        </span>
      </button>

      {/* Tooltip */}
      {!isOpen && (
        <div className="chat-widget-tooltip">
          <p>💬 Precisa de ajuda?</p>
          <p className="tooltip-subtitle">Fale com o assistente virtual</p>
        </div>
      )}
    </div>
  );
}

