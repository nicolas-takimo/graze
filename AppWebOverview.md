Documento de Referência — Projeto Graze (MVP)

1. Tipo e Propósito do App
    Tipo: Aplicativo Web3 descentralizado (dApp) de leilões de ativos agropecuários tokenizados.
    Propósito: O Graze permite que produtores tokenizem ativos agropecuários como NFTs e os leiloem em stablecoin, garantindo liquidez e transparência — mas com privacidade dos dados sensíveis por meio de cofres criptográficos.O foco do MVP é validar a mecânica de leilão on-chain e o uso de stablecoin, mantendo a experiência simples e auditável.

2. Principais Funcionalidades
    1. Tokenização de Ativos: Criação de NFTs representando ativos agrícolas (ex.: gado, soja, terra).
    2. Leilão On-Chain: Lances automáticos via smart contract, com lógica de tempo e valor mínimo.
    3. Pagamento com Stablecoin: Depósito e liquidação em stablecoin, reduzindo volatilidade.
    4. Vault Criptografado: Armazenamento de informações privadas do ativo (ex.: documentos, certificados).
    5. Histórico Público: Transparência das transações e leilões sem expor dados sensíveis.

3. Fluxo do Usuário
    1. Conectar Wallet: O usuário acessa o Graze e conecta sua carteira Web3 (MetaMask).
    2. Criar ou Navegar:
        * Produtor: cadastra o ativo e gera o NFT.
        * Investidor: navega pelos leilões ativos.
    3. Iniciar Leilão: O produtor define parâmetros (preço mínimo, duração).
    4. Dar Lance: O investidor oferece um valor em stablecoin.
    5. Encerrar e Liquidar: O contrato define o vencedor e transfere automaticamente NFT e stablecoin.
    6. Consulta: Qualquer usuário pode verificar o histórico público do leilão.

4. Estrutura de Páginas
    1. Dashboard: Tela inicial que reúne os leilões ativos e botões para “Criar Ativo” ou “Participar”.
    2. Detalhe do Leilão: Exibe informações do NFT, valor atual, tempo restante e botão de “Dar Lance”.
    3. Minhas Operações: Mostra os leilões em que o usuário participou ou criou, com status e histórico.
    4. Vault (Restrito): Acesso autenticado para dados privados do ativo (disponível apenas ao dono).
    