// /home/claudio/apiNegocios360/apps/estoqueuni/backend/ecosystem.config.cjs
// 
// ⚡ Configuração PM2 para EstoqueUni
// 
// Esta configuração garante que processos órfãos sejam mortos e a porta
// esteja liberada ANTES de iniciar o servidor, evitando loops de restart.
//
module.exports = {
  apps: [
    {
      name: "estoqueuni",
      script: "src/index.js",
      cwd: "/home/claudio/apiNegocios360/apps/estoqueuni/backend",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      
      // ✅ Limites de restart para evitar loops infinitos
      max_restarts: 10,              // Máximo 10 tentativas
      min_uptime: "10s",             // Processo deve ficar vivo 10s para contar como sucesso
      restart_delay: 5000,           // Espera 5s entre restarts
      
      // ✅ Scripts de ciclo de vida
      // ANTES de iniciar: mata processos órfãos e verifica porta
      // Usa script genérico que consulta portas-sistemas.json
      pre_start: "node ../../scripts/pm2-pre-start-generic.js --sistema=estoqueuni --porta=5010",
      
      // DEPOIS de iniciar: verifica se servidor está saudável
      post_start: "node scripts/post-start.js",
      
      // ✅ Variáveis de ambiente (se necessário)
      // Todas as variáveis principais devem estar no .env
      env: {
        NODE_ENV: "production",
      },
      
      // ✅ Logs
      error_file: "/root/.pm2/logs/estoqueuni-error.log",
      out_file: "/root/.pm2/logs/estoqueuni-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },
  ],
};

