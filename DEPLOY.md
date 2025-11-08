# 🚀 Guia de Deploy - Graze

## 📋 Pré-requisitos

1. **Node.js** instalado (v18+)
2. **Yarn** instalado
3. **Carteira** com fundos nas redes de teste:
   - Base Sepolia ETH (para contratos na Base)
   - Zama Devnet tokens (para contratos FHE)

## 🔑 Configuração das Variáveis de Ambiente

### 1. Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

### 2. Preencha as variáveis necessárias:

#### **PRIVATE_KEY**
- Sua chave privada da carteira (sem o prefixo `0x`)
- ⚠️ **NUNCA compartilhe ou commite esta chave!**
- Gerar nova carteira: `yarn generate`

#### **ALCHEMY_API_KEY**
- Obtenha em: https://dashboard.alchemyapi.io
- Crie um app para "Base Sepolia"

#### **NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID**
- Obtenha em: https://cloud.walletconnect.com
- Crie um novo projeto

#### **ETHERSCAN_V2_API_KEY** (opcional)
- Para verificar contratos
- Obtenha em: https://etherscan.io/myapikey

---

## 📦 Deploy dos Contratos

### 1️⃣ Deploy na Base Sepolia (Contratos Principais)

```bash
cd packages/hardhat
yarn deploy --network baseSepolia
```

**Contratos deployados:**
- ✅ `StableToken` (aUSD) - Token estável
- ✅ `AgroAsset` (AGRO) - NFTs de ativos agropecuários
- ✅ `VaultManager` - Gerenciamento de colateral
- ✅ `AuctionManager` - Sistema de leilões
- ✅ `MockBridgeBase` - Ponte mock para testes

### 2️⃣ Deploy no Zama (Contratos FHE - Privacidade)

**Configuração da Rede Zama:**
- RPC URL: `https://devnet.zama.ai`
- Chain ID: `8009`
- Currency: `ZAMA`
- Explorer: https://main.explorer.zama.ai

**Adicione a rede Zama na MetaMask:**
1. Abra MetaMask
2. Adicionar Rede > Adicionar rede manualmente
3. Preencha:
   - Network Name: `Zama Devnet`
   - RPC URL: `https://devnet.zama.ai`
   - Chain ID: `8009`
   - Currency: `ZAMA`
   - Block Explorer: `https://main.explorer.zama.ai`

**Obtenha tokens ZAMA:**
- Solicite no Discord da Zama: https://discord.gg/zama

**Deploy:**
```bash
yarn deploy --network zama
```

**Contratos deployados:**
- ✅ `WStableToken` (waUSD) - Token estável wrapped
- ✅ `WAgroAsset` (wAGRO) - NFTs wrapped
- ✅ `AuctionManagerFHE` - Leilões com lances privados (FHE)

---

## 🌐 Deploy do Frontend (Vercel)

### 1. Teste o build localmente:

```bash
cd packages/nextjs
yarn build
```

Se houver erros, corrija antes de fazer deploy.

### 2. Deploy na Vercel:

#### Opção A: Via CLI
```bash
# Instale a CLI da Vercel
npm i -g vercel

# Deploy
cd packages/nextjs
vercel
```

#### Opção B: Via GitHub
1. Faça push do código para o GitHub
2. Conecte o repositório na Vercel: https://vercel.com/new
3. Configure as variáveis de ambiente na Vercel

### 3. Variáveis de Ambiente na Vercel:

Configure estas variáveis no painel da Vercel:

```
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=seu_project_id
NEXT_PUBLIC_ALCHEMY_API_KEY=sua_alchemy_key
```

---

## Checklist de Deploy

- [ ] Arquivo `.env` configurado
- [ ] Carteira com fundos na Base Sepolia
- [ ] Deploy dos contratos na Base Sepolia
- [ ] Deploy dos contratos no Zama (opcional)
- [ ] Endereços dos contratos atualizados no frontend
- [ ] `yarn build` executado com sucesso
- [ ] Variáveis de ambiente configuradas na Vercel
- [ ] Deploy do frontend na Vercel
- [ ] Teste completo da aplicação em produção

---

## Verificar Contratos (Opcional)

Após o deploy, você pode verificar os contratos no Etherscan:

```bash
yarn hardhat verify --network baseSepolia DEPLOYED_CONTRACT_ADDRESS
```

---

## 🐛 Troubleshooting

### Erro: "insufficient funds"
- Adicione ETH na sua carteira na rede de teste
- Faucets:
  - Base Sepolia: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

### Erro: "nonce too high"
- Limpe o cache: `yarn hardhat clean`
- Reset da conta na MetaMask: Settings > Advanced > Clear activity tab data

### Build do Next.js falha
- Verifique erros de TypeScript: `yarn typecheck`
- Limpe o cache: `rm -rf .next`
- Reinstale dependências: `yarn install`

---

## 📞 Suporte

Para problemas ou dúvidas:
- Abra uma issue no GitHub
- Contate a equipe Graze

---

**Boa sorte com o deploy! 🌾🚀**
