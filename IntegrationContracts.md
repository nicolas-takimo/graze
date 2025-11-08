# Etapa de Integração de Contratos

## Objetivo

Integrar os módulos definidos no **PROJECT OVERVIEW**, **ARCHITECTURE** e **DESIGN SYSTEM** com os contratos inteligentes atualizados do projeto **Graze**, garantindo uma ponte segura, tipada e modular entre o front-end (Scaffold-ETH) e a lógica Solidity on-chain.

---

## 1. Contratos principais

Os contratos atualizados são:

1. `AssetNFT.sol` — Gerencia a criação e o registro de NFTs que representam ativos agropecuários.
2. `AuctionManager.sol` — Controla leilões básicos (lances, tempo, liquidação).
3. `AuctionManagerFHE.sol` — Versão aprimorada com **Fully Homomorphic Encryption** (Zama) para privacidade de lances e dados sensíveis.
4. `VaultManager.sol` — Armazena metadados confidenciais (documentos, certificados) de forma criptografada.
5. `StableToken.sol` — Implementa o token de pagamento estável (ERC-20).
6. `MockBridgeBase.sol` — Mock de bridge entre redes (ex.: integração com Base ou Layer 2).
7. `WAgroAsset.sol` — Wrapper de ativos agropecuários tokenizados para interoperabilidade entre contratos.
8. `WStableToke.sol` — Wrapper compatível ERC-20 para operações com stablecoins externas.

---

## 2. Estratégia de integração

**a. Configuração no front-end**

* Armazene os **endereços dos contratos** em `/constants/contracts.ts`.
* Use o hook `useDeployedContractInfo()` ou `useScaffoldContractWrite/Read()` quando possível.
* Defina interfaces tipadas com `typechain` (geradas pelo `yarn typechain`).
* Utilize o provider padrão do Scaffold (`wagmi + ethers v6`).

**b. Fluxos principais de integração**

* **Tokenização de ativos (AssetNFT):**

  * Conectado ao botão “Criar Ativo” no Dashboard.
  * Chamadas: `createAssetNFT(metadataURI, category, value)`.
  * Exibir toast de sucesso/erro e atualizar lista de ativos.
* **Leilão (AuctionManager / AuctionManagerFHE):**

  * `startAuction(tokenId, minPrice, duration)` → cria o leilão.
  * `placeBid(auctionId, amount)` → dar lance.
  * `finalizeAuction(auctionId)` → liquidação.
  * A versão FHE substitui `placeBid` e `revealBid` com chamadas cifradas (`encryptedBid`).
* **Pagamentos e saldos (StableToken / WStableToke):**

  * Verificação de saldo via `useBalance()` ou `readContract({ functionName: 'balanceOf' })`.
  * Aprovação antes de dar lance: `approve(AuctionManager, amount)`.
  * Após o leilão: leitura de eventos `AuctionFinalized` para atualizar saldos no front.
* **Vault (VaultManager):**

  * Funções `storeData(hash, encryptedURI)` e `getData(tokenId)` expostas a usuários autorizados.
  * Integrar com modais e tabs do Vault (acesso restrito).
* **Bridge (MockBridgeBase):**

  * Permitir testes de transações cross-chain simuladas.
  * Apenas leitura e mock no MVP (sem side effects).

---

## 3. Boas práticas de integração

1. **Evite chamadas diretas ao provider** — use os hooks do Scaffold-ETH (`useScaffoldContractWrite`, `useScaffoldContractRead`, `useDeployedContractInfo`).
2. **Crie uma camada de serviços** (`/services/contracts/`) com funções reutilizáveis para leitura/escrita, por exemplo:

   ```ts
   import { useScaffoldContractWrite } from "~~/hooks/scaffold-eth";

   export const useCreateNFT = () => {
     const { writeAsync: createAsset } = useScaffoldContractWrite({
       contractName: "AssetNFT",
       functionName: "createAssetNFT",
     });
     return { createAsset };
   };
   ```
3. **Eventos:** capture `AssetCreated`, `AuctionStarted`, `BidPlaced`, `AuctionFinalized` e `DataStored` via hooks de listener (`useContractEvent`) para atualizar o estado do front em tempo real.
4. **Validação e UX:**

   * Exiba feedback visual (`toast`, `skeleton`) durante transações.
   * Desabilite botões enquanto `tx.pending`.
   * Forneça links para block explorer (via hash de transação).
5. **Fallbacks:** em caso de falha na leitura de contrato, mostrar mensagens descritivas (“Não foi possível carregar o ativo.”).
6. **Ambiente de rede:** compatível com Base testnet, Sepolia ou Hardhat local — definir em `.env.local`.

---


## 5. Integração visual (Design System)

* Botões de transação → cores primárias `#4CAF50` / `#FFC107`
* Estados “pending/success/error” → usar tokens de status do Design System.
* Textos on-chain (endereços, IDs, hashes) → fonte `JetBrains Mono`.
* Skeletons e loaders → seguir padrão do Design System (`#E0E0E0` / `#2C2C2C`).

---

## 6. Meta de entrega

A integração deve resultar em um **dApp completo e funcional**, capaz de:

* Criar NFTs de ativos agropecuários;
* Publicar leilões on-chain e aceitar lances via stablecoin;
* Liquidar automaticamente o vencedor;
* Armazenar e consultar dados privados no Vault;
* Simular transações cross-chain com MockBridge.

---