# Documento de Arquitetura de Páginas — **Graze (MVP)**

## 1) Página: **Dashboard**

**Propósito**

* Listar leilões ativos e recentes.
* Ações rápidas: criar ativo (produtor), entrar em leilão (investidor).
* Visão geral (KPIs): nº de leilões ativos, volume em stablecoin, tempo médio de liquidação.

**Estrutura de layout**

* Header (logo, Connect Wallet, menu compacto).
* Barra de filtros (busca por texto, status, categoria do ativo, ordenação por tempo/valor).
* Área principal (grid de cards de leilões).
* Footer (links básicos, versão do app, rede).

**Componentes principais**

* Cards de Leilão: imagem do NFT (ou placeholder), título, categoria (gado/soja/terra), lance atual, tempo restante, status (ativo/encerrado/pendente), botão “Ver Leilão”.
* KPIs (mini-widgets).
* Filtro/Busca (input + selects).
* CTA “Criar Ativo” (se carteira conectada e com permissão de produtor).
* Toasts/Snackbars (feedback).

**Elementos interativos**

* Botões: “Ver Leilão”, “Criar Ativo”, “Conectar Wallet”.
* Inputs de filtro/ordenação e busca.
* Card clicável abre detalhes.
* Páginação ou scroll infinito.

**Navegação**

* Entrada: rota “/” ou “/dashboard”, menus ou deep link.
* Saída: “Ver Leilão” → “/auction/:id”; “Criar Ativo” → fluxo de criação (modal/wizard ou “/create”).
* Header leva a “Minhas Operações” e “Vault”.

**Conteúdo**

* Texto curto de boas-vindas.
* Cards com: título do ativo, ID do NFT, lance atual (StableToken), tempo restante (AuctionManager), selo “Privado” (dados no Vault), tags.
* KPIs: total de leilões, volume, liquidações últimas 24h.

**Estados**

* Carregando: skeleton de cards + spinner em KPIs.
* Vazio: “Nenhum leilão ativo no momento. Tente remover filtros ou volte mais tarde.”
* Erro: banner com “Falha ao carregar leilões” + botão “Tentar de novo”.

---

## 2) Página: **Detalhe do Leilão**

**Propósito**

* Exibir tudo o que é necessário para decidir e dar lance.
* Transparência pública (histórico de lances/estados) sem revelar dados sensíveis.
* Encerrar e liquidar (quando aplicável).

**Estrutura de layout**

* Header (logo, Connect Wallet, breadcrumbs).
* Coluna Esquerda: mídia do NFT (imagem, vídeo, placeholder).
* Coluna Direita: informações do leilão (título, lance atual, tempo restante, regras), ações (Dar Lance/Encerrar).
* Abaixo: tabs (Descrição pública, Histórico, Documentos privados – bloqueados).
* Footer.

**Componentes principais**

* Resumo do Leilão (AuctionManager):

  * Preço mínimo, incremento, moeda (stablecoin), tempo restante, estado (ativo/encerrado/liquidado).
* Box “Dar Lance”:

  * Input de valor (em stablecoin), botão “Dar Lance”, aviso de taxa de rede, saldo disponível.
* Tabela de Histórico de Lances: endereço, valor, timestamp, status (maior/ultrapassado).
* Tab “Descrição Pública”: metadados não sensíveis do **AssetNFT** (categoria, certificações públicas, localidade geral).
* Tab “Documentos Privados” (trancada): indicação que o acesso é via **VaultManager** (apenas autorizado).
* Box “Riscos e Avisos”: volatilidade residual, custódia de chaves, compliance local (texto orientativo).
* Toasts/Snackbars.

**Elementos interativos**

* “Dar Lance” (validação: valor ≥ lance atual + incremento, saldo suficiente, aprovação do token se necessário).
* “Aprovar Stablecoin” (se primeira vez).
* “Encerrar Leilão” (se for criador e tempo acabou; chama função de finalize).
* Tabs (troca entre Descrição, Histórico, Documentos).
* Copiar IDs/endereços (NFT, leilão, contratos).
* Link para explorador (block explorer) do NFT e da transação.

**Navegação**

* Entrada: “/auction/:id” pelos cards do Dashboard, deep link ou histórico.
* Saída: “Minhas Operações” após lance/compra; voltar para Dashboard.

**Conteúdo**

* Título do ativo, ID NFT, contrato do leilão, rede, seller (abreviado).
* Valores: lance atual, incremento mínimo, buyout (se houver), preço mínimo, depósito/garantias.
* Relógio regressivo.
* Historico de Lances (paginado).
* Indicação de privacidade: “Dados confidenciais disponíveis apenas no Vault aos autorizados”.

**Estados**

* Carregando: skeleton em todas as boxes, relógio em standby.
* Vazio (histórico): “Ainda sem lances — seja o primeiro.”
* Erro: banners em cada box com mensagem e retry.
* Pós-Liquidação: estado “Liquidado”, mostra comprador, valor final, link on-chain.

---

## 3) Página: **Minhas Operações**

**Propósito**

* Visão unificada do que o usuário **criou** (como produtor) e **participou** (como investidor).
* Acompanhar status, resultados e acessar comprovantes/transações.

**Estrutura de layout**

* Header (logo, Connect Wallet, menu).
* Abas ou filtros no topo: “Criados por mim” | “Participei” | “Todos”.
* Lista/Tabela principal com registros.
* Footer.

**Componentes principais**

* Tabela com colunas:

  * Tipo (NFT/Leilão), ID/Link, Título, Papel (Produtor/Investidor), Status (ativo/encerrado/liquidado), Valor (lance dado / valor final), Data/Hora, Ações.
* Filtros: período, status, categoria.
* Botão “Criar Ativo” (se produtor).

**Elementos interativos**

* Cliques nos IDs → abre “Detalhe do Leilão” ou “Detalhe do NFT”.
* Filtros e busca.
* Exportar CSV (opcional, posterior).
* Ações por linha: “Ver”, “Abrir no explorador”.

**Navegação**

* Entrada: menu/header ou pós-ação (ex.: após dar lance).
* Saída: volta ao Dashboard; segue para Detalhe do Leilão.

**Conteúdo**

* Registros agregados do usuário:

  * Como **Produtor**: NFTs criados, leilões iniciados, status e resultados.
  * Como **Investidor**: lances feitos, posições vencidas/perdidas, liquidações.
* Resumo no topo (cards): total de lances, vitórias, volume transacionado.

**Estados**

* Carregando: skeleton de linhas.
* Vazio:

  * “Você ainda não criou nenhum NFT/leilão” com CTA “Criar Ativo”.
  * “Você ainda não participou de leilões” com CTA “Explorar leilões”.
* Erro: banner e retry.

---

## 4) Página: **Vault (Restrito)**

**Propósito**

* Armazenar e disponibilizar **dados confidenciais** de um ativo (ex.: certificados, documentos fiscais, laudos) de forma criptografada.
* Exibição **somente** a usuários autorizados via lógica de **VaultManager**.

**Estrutura de layout**

* Header (logo, Connect Wallet, indicação de usuário autorizado).
* Área principal:

  * Lista de documentos/itens privados por NFT/Leilão.
  * Painel de permissões (somente leitura no MVP).
* Footer.

**Componentes principais**

* Lista de Documentos (cards ou tabela): nome, tipo, tamanho, hash, última atualização, ações (abrir/baixar se permitido).
* Painel do Ativo (resumo mínimo: ID NFT, dono, status do leilão).
* Mensagens de acesso: “Você não possui permissão para este conteúdo.”
* Modal “Solicitar Acesso” (opcional futuro; no MVP exibe instrução de contato/processo off-chain).
* Toasts/Snackbars.

**Elementos interativos**

* “Abrir Documento” / “Baixar” (se autorizado).
* Copiar hash/ID para portapapéis.
* Filtrar por ativo/NFT.
* (Opcional futuro) “Solicitar acesso”.

**Navegação**

* Entrada: header/menu, link “Documentos” no Detalhe do Leilão (tab bloqueada aponta para Vault).
* Saída: volta a Detalhe do Leilão ou Dashboard.

**Conteúdo**

* Lista de documentos do ativo selecionado (somente metadados não sensíveis até validação de permissão).
* Se autorizado: visualização/baixa do conteúdo (stream seguro).
* Informativos sobre a política de privacidade e registro on-chain do acesso (se aplicável).

**Estados**

* Carregando: skeleton em lista de documentos.
* Sem permissão: card central “Acesso negado — esta seção é restrita” com instrução mínima.
* Vazio (com permissão): “Nenhum documento privado anexado a este ativo.”
* Erro: banner “Falha ao consultar permissões/itens do Vault”.

---



