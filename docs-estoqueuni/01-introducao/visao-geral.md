---
titulo: Visão Geral do Sistema
categoria: introducao
tags: [visao-geral, sistema, estoqueuni]
dificuldade: basico
ultima_atualizacao: 2025-01-29
---

# Visão Geral do EstoqueUni

O EstoqueUni é um sistema de sincronização unificada de estoques que permite gerenciar múltiplas contas Bling ERP de forma centralizada e automatizada.

## 🎯 Objetivo Principal

O EstoqueUni foi desenvolvido para resolver o problema de gerenciar estoques em múltiplas contas Bling, permitindo:

- Sincronização automática de estoques entre contas
- Gerenciamento centralizado de depósitos
- Notificações em tempo real via webhooks
- Histórico completo de sincronizações
- Verificação periódica automática de estoques

## ✨ Principais Funcionalidades

### 1. Multi-Conta Bling
- Conecte múltiplas contas Bling ao mesmo sistema
- Gerencie todas as contas de um único lugar
- Configureções independentes por conta

### 2. Sincronização Automática
- Sincronização via webhooks em tempo real
- Verificação periódica automática (cronjob)
- Sincronização manual sob demanda

### 3. Gerenciamento de Depósitos
- Configure depósitos principais e compartilhados
- Crie novos depósitos diretamente no Bling
- Gerencie mapeamento de depósitos entre contas

### 4. Monitoramento
- Histórico completo de sincronizações
- Logs detalhados de operações
- Status de sincronização em tempo real

## 🏗️ Arquitetura

O sistema é composto por:

- **Frontend**: Interface web React para gerenciamento
- **Backend**: API Node.js/Express para processamento
- **Webhooks**: Recebimento de notificações do Bling
- **Cronjobs**: Verificação periódica automática
- **Banco de Dados**: MongoDB para persistência

## 🔐 Segurança

- Autenticação por tenant (multi-tenant)
- Tokens OAuth para integração com Bling
- Isolamento de dados por conta
- Logs de auditoria

## 📊 Status do Sistema

O sistema monitora automaticamente:
- Status geral da sincronização
- Status de webhooks por conta
- Status da sincronização automática (cronjob)
- Última sincronização realizada

