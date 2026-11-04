# Especificação - Document Management System

## 1. Objetivo

Entregar uma aplicação web simples para que usuários enviem documentos, consultem os próprios envios e baixem os arquivos armazenados localmente.

## 2. Escopo

### Dentro do escopo

- Upload de um documento por requisição.
- Listagem dos documentos associados ao usuário da requisição.
- Download de um documento pelo identificador, limitado ao seu proprietário.
- Interface React para upload, listagem e download.
- Armazenamento de arquivos no filesystem local com `multer` e `diskStorage`.
- Metadados mantidos em memória durante a execução do processo.
- Identificação simples do usuário por requisição, sem cadastro ou autenticação nesta versão.

### Fora do escopo

- Armazenamento em nuvem, banco de dados ou provedores externos.
- Persistência ou recuperação automática dos metadados após reiniciar o backend.
- Versionamento, edição, exclusão ou compartilhamento de documentos.
- Cadastro de usuários, login, autenticação e administração de contas.
- Antivírus, inspeção do conteúdo, OCR, busca textual ou conversão de arquivos.
- Garantia de acesso seguro em uma implantação pública sem uma camada confiável de autenticação.

## 3. Requisitos funcionais

| ID | Requisito | Critério de aceite |
| --- | --- | --- |
| RF-01 | O usuário pode enviar um documento usando `multipart/form-data`. | Um arquivo válido gera um identificador e retorna seus metadados; requisição sem arquivo, arquivo vazio ou acima do limite é rejeitada. |
| RF-02 | O sistema associa cada documento a um proprietário. | O proprietário vem do contexto da requisição, nunca de um campo livre do formulário; a API não retorna documentos de outro usuário. |
| RF-03 | O usuário pode listar seus documentos. | A resposta contém somente documentos do usuário identificado, ordenados do mais recente para o mais antigo. Lista vazia retorna sucesso com coleção vazia. |
| RF-04 | O usuário pode baixar um documento pelo identificador. | Um documento existente e pertencente ao usuário é retornado como conteúdo binário com nome de download apropriado. |
| RF-05 | O sistema informa erros de forma consistente. | Erros da API retornam JSON com código estável e mensagem compreensível; nenhuma resposta expõe caminhos locais ou detalhes internos. |
| RF-06 | A interface permite realizar os fluxos principais. | O usuário consegue enviar arquivo, ver os próprios documentos, iniciar download e perceber estados de carregamento, sucesso e erro. |
| RF-07 | O usuário pode identificar o contexto de usuário ativo na interface. | A interface mantém um identificador simples para as requisições desta versão; trocar de usuário atualiza a listagem exibida. Não representa autenticação. |

## 4. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Os arquivos são gravados somente em filesystem local, em `backend/storage` por padrão, usando `multer` com `diskStorage`. |
| RNF-02 | Os metadados são mantidos em memória; reiniciar o processo limpa o catálogo, mesmo que os arquivos permaneçam no disco. |
| RNF-03 | Configurações operacionais são obtidas por variáveis de ambiente, com padrões documentados. |
| RNF-04 | O nome recebido do usuário nunca é usado como caminho de armazenamento. O backend gera um nome interno imprevisível e mantém o nome original apenas como metadado. |
| RNF-05 | O limite padrão de upload é 10 MiB e pode ser alterado por configuração. Arquivos de tamanho zero são rejeitados. Não há allowlist de extensões nesta versão; tipo MIME informado pelo cliente não é considerado confiável. |
| RNF-06 | A API verifica propriedade antes de listar ou baixar. Documento inexistente e documento de outro usuário produzem a mesma resposta 404, evitando revelar sua existência. |
| RNF-07 | O backend não retorna ao cliente caminho de disco nem nome interno de armazenamento. |
| RNF-08 | O código backend segue a Clean Architecture simples, com dependências direcionadas de `routes` para `controllers`, `services` e `repositories`. |
| RNF-09 | O frontend usa React e consome a API com `fetch` pelo prefixo `/api`; em desenvolvimento, o proxy do Vite encaminha ao backend e remove esse prefixo. |
| RNF-10 | A suíte backend usa o runner nativo `node:test`. O comportamento principal deve ser verificável sem armazenamento externo. |

### Configuração

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP do backend. |
| `STORAGE_DIR` | `backend/storage` (resolvido a partir da aplicação) | Diretório local de arquivos. |
| `MAX_FILE_SIZE_BYTES` | `10485760` | Tamanho máximo de arquivo em bytes. |

O diretório de armazenamento deve existir ou ser criado pelo backend na inicialização. Em caso de falha de escrita, a API responde com erro sem expor detalhes do filesystem.

## 5. Modelo de dados

### Documento

| Campo | Tipo | Exposição | Descrição |
| --- | --- | --- | --- |
| `id` | string | API e interno | Identificador único, gerado pelo backend. |
| `originalName` | string | API e interno | Nome original fornecido no upload, tratado como dado não confiável. |
| `size` | number | API e interno | Tamanho do arquivo em bytes. |
| `uploadedAt` | string | API e interno | Data/hora de recebimento em UTC, formato ISO 8601. |
| `owner` | string | API e interno | Identificador do usuário associado à requisição. |
| `storageName` | string | Somente interno | Nome gerado pelo backend e usado para localizar o arquivo no diretório local; nunca enviado pela API. |

O repositório mantém um registro em memória indexado por `id`. O arquivo correspondente reside em `STORAGE_DIR/storageName`. Se a gravação do arquivo funcionar, mas o registro dos metadados falhar, o backend deve remover o arquivo recém-gravado e retornar erro. Arquivos de execuções anteriores não são reindexados após reinício; sua limpeza automática não faz parte desta versão.

### Identidade do usuário

Para a versão demonstrativa, a API recebe o identificador por `X-User-Id`, com espaços removidos e comprimento de 1 a 128 caracteres. A interface envia esse cabeçalho a partir do contexto de usuário ativo. O backend rejeita cabeçalho ausente ou inválido com 401. Esse cabeçalho é apenas um mecanismo de demonstração e pode ser forjado pelo cliente; antes de qualquer implantação exposta, deve ser substituído ou preenchido por middleware confiável de autenticação. Não se deve tratar o identificador como credencial.

## 6. Contratos de API

Os caminhos abaixo são relativos à raiz do backend Express. O frontend usa `/api` como prefixo de desenvolvimento, removido pelo proxy do Vite; portanto, por exemplo, `GET /api/documents` no navegador chega ao backend como `GET /documents`.

### Formato de erro

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A solicitação não é válida."
  }
}
```

### `POST /upload`

- Autorização de usuário: cabeçalho `X-User-Id` obrigatório.
- Entrada: `multipart/form-data`, campo de arquivo `file`, um arquivo por solicitação.
- Resposta `201 Created`: objeto de metadados públicos do documento (`id`, `originalName`, `size`, `uploadedAt`, `owner`).
- Respostas de erro: `400 VALIDATION_ERROR` para ausência ou tamanho zero; `401 USER_REQUIRED` para usuário ausente/inválido; `413 FILE_TOO_LARGE` acima do limite; `500 STORAGE_ERROR` para falha de armazenamento.
- O corpo não aceita `owner`, `id` ou nome interno de armazenamento como valores definidos pelo cliente.

### `GET /documents`

- Autorização de usuário: cabeçalho `X-User-Id` obrigatório.
- Entrada: sem corpo ou parâmetros de consulta nesta versão.
- Resposta `200 OK`: array de objetos de metadados públicos pertencentes ao usuário, ordenado por `uploadedAt` decrescente. Sem documentos, retorna `[]`.
- Resposta de erro: `401 USER_REQUIRED` para usuário ausente/inválido.

### `GET /documents/:id/download`

- Autorização de usuário: cabeçalho `X-User-Id` obrigatório.
- Entrada: identificador do documento no caminho.
- Resposta `200 OK`: bytes do arquivo, `Content-Disposition: attachment` com o nome original tratado para uso seguro em cabeçalho HTTP e `Content-Type: application/octet-stream`.
- Respostas de erro: `401 USER_REQUIRED` para usuário ausente/inválido; `404 DOCUMENT_NOT_FOUND` se o documento não existir, não pertencer ao usuário ou o arquivo não estiver disponível; `500 STORAGE_ERROR` para outras falhas de leitura.

### `GET /health`

- Resposta `200 OK`: `{"status":"ok"}` quando o processo HTTP está ativo. Não verifica a integridade de cada arquivo.

## 7. Decisões arquiteturais

- **Routes:** declaram os caminhos e encaminham a requisição ao controller correspondente.
- **Controllers:** validam os dados HTTP, obtêm `X-User-Id`, chamam os serviços e traduzem resultados/erros para status e JSON ou stream HTTP.
- **Services:** implementam as regras de upload, associação ao proprietário e autorização de listagem/download sem depender de Express ou Multer.
- **Repositories:** encapsulam o catálogo em memória e as operações sobre arquivos locais. A configuração de armazenamento e a integração com `multer` permanecem na borda de infraestrutura.
- A aplicação usa CommonJS no backend e ES modules no frontend; não introduzir TypeScript ou serviços de armazenamento externos.
- O frontend organiza a interface em componentes e concentra chamadas `fetch` em um serviço, usando o proxy `/api` em desenvolvimento.
- O backend é a autoridade sobre identificadores, nomes internos, datas e propriedade dos documentos.
- Não existe persistência transacional entre memória e disco. A compensação de falha no upload remove o arquivo recém-criado quando não for possível registrar seus metadados.

## 8. Plano de execução

Etapas propostas para uma fase posterior. Este documento registra o plano; nenhuma etapa de implementação de backend ou frontend faz parte da criação desta especificação.

1. Revisar e aprovar escopo, limite de upload, identificação demonstrativa do usuário e contratos HTTP.
2. Implementar a configuração do backend, armazenamento local com `multer`, repositório em memória e regras dos serviços conforme as restrições desta especificação.
3. Expor os contratos por rotas e controllers, incluindo validação, isolamento por proprietário, tratamento uniforme de erros e endpoint de saúde.
4. Cobrir os casos de sucesso e falha da API com testes automatizados, incluindo upload, listagem por usuário, download, limite de tamanho e falhas de armazenamento.
5. Implementar a interface React de seleção de usuário demonstrativo, upload, listagem, estados de erro/carregamento e download.
6. Integrar frontend e backend pelo proxy `/api`, validar o fluxo ponta a ponta e executar as verificações de build e testes disponíveis.
7. Registrar limitações da versão e confirmar que nenhuma configuração ou código introduziu armazenamento externo; tratar autenticação real como requisito separado antes de exposição pública.

## 9. Critérios de conclusão

- Upload grava o arquivo localmente e retorna metadados sem expor o caminho ou nome interno.
- Usuários diferentes recebem catálogos isolados e não conseguem baixar documentos alheios.
- Erros de validação, tamanho, identidade e filesystem usam os contratos definidos.
- A interface executa upload, atualização da lista e download via API.
- Testes backend e build do frontend passam, e o comportamento de perda do catálogo após reinício está documentado.