# 🔒 Configuração do Cloudflare para EstoqueUni

## ⚠️ Problema Atual: Erro 521

O erro 521 significa que o Cloudflare não consegue se conectar ao servidor de origem. 

**Situação identificada:**
- O DNS do Cloudflare está apontando para `45.56.77.200` (servidor remoto Linode Dallas)
- Esse servidor não está respondendo nas portas 80/443
- O EstoqueUni está rodando no servidor atual (não no `45.56.77.200`)

## ✅ Solução: Atualizar DNS no Cloudflare

### Passo 1: Identificar o IP Correto do Servidor Atual

Execute no servidor onde o EstoqueUni está rodando:
```bash
curl -4 ifconfig.me
```

Este comando retornará o IP público IPv4 do servidor atual.

### Passo 2: Configurar DNS no Cloudflare

1. Acesse o painel do Cloudflare: https://dash.cloudflare.com
2. Selecione o domínio `estoqueuni.com.br`
3. Vá em **DNS** → **Records**
4. Verifique/Configure os registros A:

   **Registro A Principal:**
   - **Type:** A
   - **Name:** `estoqueuni.com.br` (ou `@`)
   - **IPv4 address:** `[IP_DO_SERVIDOR]` (obtido no Passo 1)
   - **Proxy status:** 🟠 Proxied (nuvem laranja)
   - **TTL:** Auto

   **Registro A para www:**
   - **Type:** A
   - **Name:** `www`
   - **IPv4 address:** `[IP_DO_SERVIDOR]` (mesmo IP)
   - **Proxy status:** 🟠 Proxied (nuvem laranja)
   - **TTL:** Auto

### Passo 3: Configurar SSL/TLS no Cloudflare

1. No painel do Cloudflare, vá em **SSL/TLS**
2. Configure o **SSL/TLS encryption mode:**

   **Opção A: Flexible (Recomendado para começar)**
   - Cloudflare → Usuário: HTTPS ✅
   - Cloudflare → Servidor: HTTP ✅
   - **Vantagem:** Funciona mesmo sem certificado válido no servidor
   - **Desvantagem:** Tráfego entre Cloudflare e servidor não é criptografado

   **Opção B: Full (Recomendado após configurar SSL)**
   - Cloudflare → Usuário: HTTPS ✅
   - Cloudflare → Servidor: HTTPS ✅
   - **Vantagem:** Tráfego totalmente criptografado
   - **Requisito:** Servidor precisa ter certificado SSL válido (já configurado ✅)

   **Opção C: Full (strict) (Melhor segurança)**
   - Cloudflare → Usuário: HTTPS ✅
   - Cloudflare → Servidor: HTTPS ✅ (com validação de certificado)
   - **Vantagem:** Máxima segurança
   - **Requisito:** Certificado SSL válido e reconhecido (Let's Encrypt recomendado)

### Passo 4: Verificar Configurações Adicionais

1. **Always Use HTTPS:**
   - Vá em **SSL/TLS** → **Edge Certificates**
   - Ative **Always Use HTTPS** ✅

2. **Automatic HTTPS Rewrites:**
   - Ative **Automatic HTTPS Rewrites** ✅

3. **Minimum TLS Version:**
   - Configure para **TLS 1.2** ou superior

### Passo 5: Verificar Firewall (se aplicável)

Se o servidor tiver firewall, certifique-se de que as portas 80 e 443 estão abertas:

```bash
# Verificar UFW
sudo ufw status

# Se necessário, abrir portas
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Passo 6: Testar Conexão

Após configurar, aguarde alguns minutos para o DNS propagar e teste:

```bash
# Testar DNS
dig +short estoqueuni.com.br

# Testar acesso direto ao servidor (deve funcionar)
curl -I http://[IP_DO_SERVIDOR]/health

# Testar via Cloudflare (deve funcionar após configuração)
curl -I https://estoqueuni.com.br/health
```

## 🔄 Migração para Let's Encrypt (Opcional)

Após configurar o Cloudflare corretamente, você pode migrar para certificados Let's Encrypt:

1. Configure o Cloudflare para **Full** ou **Full (strict)**
2. Execute o script de renovação:
   ```bash
   sudo /home/claudio/semtypescript/apps/estoqueuni/scripts/renovar-ssl.sh
   ```
3. O script tentará automaticamente migrar para Let's Encrypt

## 📋 Checklist de Configuração

- [ ] IP do servidor identificado
- [ ] Registro A configurado no Cloudflare apontando para o IP do servidor
- [ ] Proxy status: 🟠 Proxied (nuvem laranja)
- [ ] SSL/TLS mode configurado (Flexible, Full ou Full strict)
- [ ] Always Use HTTPS ativado
- [ ] Portas 80 e 443 abertas no firewall (se aplicável)
- [ ] Teste de conexão bem-sucedido

## 🆘 Troubleshooting

### Erro 521 persiste:
1. Verifique se o IP do registro A está correto
2. Verifique se o servidor está acessível diretamente pelo IP
3. Verifique se as portas 80/443 estão abertas
4. Verifique o modo SSL/TLS no Cloudflare

### Erro 526 (Invalid SSL certificate):
- Configure Cloudflare para **Full (strict)** apenas após ter certificado Let's Encrypt válido
- Ou use **Full** com certificado auto-assinado (funciona, mas com aviso)

### Erro 502:
- Verifique se o backend está rodando
- Verifique os logs do nginx: `docker logs estoqueuni-nginx`

## 📞 Suporte

Para mais informações sobre configuração do Cloudflare:
- Documentação: https://developers.cloudflare.com/ssl/origin-configuration/
- Status: https://www.cloudflarestatus.com/



