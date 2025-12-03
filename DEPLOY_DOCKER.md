# 🚀 Deploy do EstoqueUni com Docker

## 📋 Workflow de Deploy

### ⚠️ **IMPORTANTE: Diferença do Workflow Antigo**

**Antes (sem Docker):**
- Alterava arquivo → SFTP enviava → PM2 reiniciava → Pronto ✅

**Agora (com Docker):**
- Alterou arquivo → **Precisa fazer build da imagem** → Enviar para servidor → Subir containers → Pronto ✅

### 🔄 **Processo Completo**

1. **Desenvolvimento Local:**
   ```bash
   # Alterar arquivos normalmente
   # Testar localmente com Docker
   npm run dev-estoqueuni
   ```

2. **Deploy para Produção:**
   ```bash
   # Opção 1: Script automático (recomendado)
   cd /home/claudio/semtypescript/apps/estoqueuni
   ./deploy-docker.sh
   
   # Opção 2: Manual (passo a passo)
   # Ver seção "Deploy Manual" abaixo
   ```

## 🎯 Deploy Automático (Recomendado)

### Pré-requisitos

1. **Arquivo `.env` configurado** na raiz do projeto com variáveis de produção
2. **SSH configurado** (`Linode_dallas` no `~/.ssh/config`)
3. **Docker instalado** no servidor de produção

### Executar Deploy

```bash
cd /home/claudio/semtypescript/apps/estoqueuni
./deploy-docker.sh
```

O script vai:
1. ✅ Verificar arquivos necessários
2. ✅ Enviar código para o servidor (via rsync)
3. ✅ Enviar arquivo `.env` (se existir)
4. ✅ Fazer build das imagens Docker no servidor
5. ✅ Parar containers antigos
6. ✅ Iniciar containers em produção
7. ✅ Mostrar status dos containers

**Tempo estimado:** 5-15 minutos (depende do tamanho do build)

## 🛠️ Deploy Manual (Passo a Passo)

Se preferir fazer manualmente ou o script der erro:

### 1️⃣ Preparar Código Local

```bash
cd /home/claudio/semtypescript/apps/estoqueuni

# Verificar se .env existe
ls -la .env
```

### 2️⃣ Enviar Código para Servidor

```bash
# Enviar código (excluindo node_modules, build, etc)
rsync -avz --progress \
  --exclude='node_modules' \
  --exclude='build' \
  --exclude='dist' \
  --exclude='.git' \
  --exclude='*.log' \
  --exclude='.env' \
  ./ Linode_dallas:/home/claudio/semtypescript/apps/estoqueuni/

# Enviar .env separadamente (se existir)
scp .env Linode_dallas:/home/claudio/semtypescript/apps/estoqueuni/.env
```

### 3️⃣ Conectar no Servidor

```bash
ssh Linode_dallas
```

### 4️⃣ No Servidor: Build e Deploy

```bash
cd /home/claudio/semtypescript/apps/estoqueuni

# Verificar se .env existe
ls -la .env

# Build das imagens
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml build

# Parar containers antigos (se existirem)
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml down

# Iniciar containers
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml up -d

# Ver status
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml ps

# Ver logs
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml logs -f
```

## 🔄 Atualizar Apenas Código (Sem Rebuild)

Se você alterou apenas código e não dependências:

```bash
# 1. Enviar código
rsync -avz --progress \
  --exclude='node_modules' \
  --exclude='build' \
  --exclude='dist' \
  --exclude='.git' \
  ./ Linode_dallas:/home/claudio/semtypescript/apps/estoqueuni/

# 2. No servidor: Rebuild apenas do serviço alterado
ssh Linode_dallas << 'ENDSSH'
cd /home/claudio/semtypescript/apps/estoqueuni

# Rebuild apenas do backend (exemplo)
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml build estoqueuni-backend

# Reiniciar apenas o backend
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml up -d --force-recreate estoqueuni-backend
ENDSSH
```

## 📝 Comandos Úteis no Servidor

```bash
# Ver logs de todos os serviços
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml logs -f

# Ver logs de um serviço específico
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml logs -f estoqueuni-backend

# Ver status dos containers
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml ps

# Reiniciar um serviço específico
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml restart estoqueuni-backend

# Parar tudo
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml down

# Parar e remover volumes (cuidado!)
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml down -v
```

## ⚠️ Notas Importantes

1. **SFTP/rsync ainda funciona**, mas não é suficiente - precisa fazer build das imagens
2. **Build é feito no servidor** (mais lento, mas garante compatibilidade)
3. **Arquivo `.env`** deve estar configurado com variáveis de produção
4. **Primeira vez** pode demorar mais (baixa imagens base do Docker)
5. **Atualizações futuras** são mais rápidas (cache do Docker)

## 🐛 Troubleshooting

### Erro: "Cannot connect to Docker daemon"
```bash
# Verificar se Docker está rodando no servidor
ssh Linode_dallas "systemctl status docker"
```

### Erro: "Port already in use"
```bash
# Verificar o que está usando a porta
ssh Linode_dallas "lsof -i :80"
```

### Containers não iniciam
```bash
# Ver logs detalhados
ssh Linode_dallas "cd /home/claudio/semtypescript/apps/estoqueuni && docker compose -f docker-compose.base.yml -f docker-compose.prod.yml logs"
```

## 📚 Próximos Passos

- [ ] Configurar SSL/HTTPS
- [ ] Configurar backup automático do Redis
- [ ] Configurar monitoramento (Prometheus, Grafana)
- [ ] Otimizar build (usar cache do Docker Hub)



