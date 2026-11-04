---
description: Executa os testes do backend e explica o resultado sem alterar arquivos.
name: verificar-backend
argument-hint: resumo opcional da alteração que deseja validar
agent: agent
---

# Verificar testes do backend

Contexto opcional da alteração: `${input:contexto:resumo da alteração, se houver}`

Execute `npm --prefix backend test`.

Requisitos:

- Explique em linguagem simples quantos testes passaram ou falharam.
- Se houver falha, informe o nome do teste e o motivo provável.
- Não altere arquivos nem tente corrigir o problema.
- Se não conseguir executar os testes, explique o motivo.