# Chainlink Price Feed - Base Sepolia

## Situação Atual

A Base Sepolia é uma testnet relativamente nova e **pode não ter Price Feeds oficiais do Chainlink disponíveis ainda**.

### Endereço Testado (NÃO FUNCIONA):
- `0x4adc67696ba383f43dd60a9ea083f30304242666` - Retorna dados vazios

## Solução Implementada

Estamos usando um **Mock Price Feed** deployado na Base Sepolia:

```solidity
// MockPriceFeed.sol
// Simula um Chainlink Price Feed retornando $3000 para ETH/USD
```

### Endereço do Mock:
- **MockPriceFeed**: `0xb09450B8BbDa0CaFAE98d15B6f545BCC2a977B89`
- **Preço fixo**: $3,000 USD
- **Decimais**: 8

## Por Que Usar Mock?

1. **Testnet Limitada**: Base Sepolia pode não ter todos os Price Feeds do mainnet
2. **Desenvolvimento**: Mock permite testar sem depender de oracles externos
3. **Confiável**: Sempre retorna dados válidos para testes

## Para Produção (Base Mainnet)

Quando fazer deploy na Base Mainnet, você DEVE:

1. Verificar os Price Feeds oficiais em: https://docs.chain.link/data-feeds/price-feeds/addresses
2. Usar o endereço correto do Chainlink para Base Mainnet
3. Testar o Price Feed antes do deploy

## Alternativas para Base Sepolia

Se precisar de Price Feeds reais na testnet:

1. **Usar Ethereum Sepolia**: Tem Price Feeds oficiais
2. **API Direta**: Buscar preços de APIs (CoinGecko, CoinMarketCap)
3. **Chainlink Functions**: Criar custom oracle

## Código Atual

```typescript
// deploy/00_deploy_contracts.ts
const mockPriceFeedDeployment = await deploy("MockPriceFeed", {
  from: deployer,
  args: [300000000000, 8], // $3000 com 8 decimais
  log: true,
});
```

## Verificação

Para verificar se um Price Feed funciona:

```bash
npx hardhat run scripts/testPriceFeed.js --network baseSepolia
```

---

**Nota**: Esta é uma solução válida para testnet. Para produção, sempre use Price Feeds oficiais do Chainlink.
