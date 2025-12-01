import { useEffect, useState } from "react";
import axios from "axios";

/**
 * Página intermediária para o retorno OAuth do Bling.
 * Quando o Bling redireciona o navegador para /bling/callback,
 * este componente captura os parâmetros, encaminha-os para o backend real
 * (/api/bling/auth/callback) e mostra mensagens de status amigáveis.
 */
export default function BlingCallback() {
  const [status, setStatus] = useState("Preparando redirecionamento…");
  const [helperUrl, setHelperUrl] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    if (error) {
      setStatus(
        `O Bling retornou o erro "${error}". ${errorDescription || "Revise a autorização e tente novamente."}`
      );
      return;
    }

    const code = params.get("code");
    const state = params.get("state");

    if (!code || !state) {
      setStatus("Resposta inválida do Bling: parâmetros obrigatórios ausentes.");
      return;
    }

    // Parse do state para extrair tenantId e blingAccountId
    let stateData;
    try {
      stateData = JSON.parse(state);
    } catch {
      setStatus("State inválido: formato JSON esperado.");
      return;
    }

    const { tenantId, blingAccountId } = stateData;

    if (!tenantId || !blingAccountId) {
      setStatus("State inválido: deve conter tenantId e blingAccountId.");
      return;
    }

    // Enviar para o backend do estoqueuni
    const apiBase = window.location.origin;
    const targetUrl = `${apiBase}/api/bling/auth/callback?code=${code}&state=${encodeURIComponent(state)}`;
    setHelperUrl(targetUrl);
    setStatus("Redirecionando para o backend…");

    // Fazer requisição para o backend
    axios
      .get(targetUrl, { withCredentials: true })
      .then((response) => {
        if (response.data.success) {
          setStatus("✅ Conta autorizada com sucesso! Você pode fechar esta janela.");
          // Fechar popup após 2 segundos
          setTimeout(() => {
            if (window.opener) {
              window.close();
            } else {
              // Se não for popup, redirecionar para a página de contas
              window.location.href = "/contas-bling";
            }
          }, 2000);
        } else {
          setStatus(`Erro: ${response.data.error || "Erro desconhecido"}`);
        }
      })
      .catch((error) => {
        console.error("❌ Erro ao processar callback:", error);
        setStatus(
          `Erro ao processar autorização: ${error.response?.data?.error || error.message}`
        );
      });
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
        textAlign: "center",
        gap: "12px",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Integração Bling - EstoqueUni</h1>
      <p style={{ maxWidth: 480, color: "#555" }}>{status}</p>
      {helperUrl && !status.includes("sucesso") && (
        <p>
          Se nada acontecer automaticamente,{" "}
          <a href={helperUrl}>clique aqui para finalizar a conexão</a>.
        </p>
      )}
      {!helperUrl && !status.includes("sucesso") && (
        <p style={{ fontSize: "0.9rem", color: "#777" }}>
          Feche esta janela e tente novamente.
        </p>
      )}
    </div>
  );
}













