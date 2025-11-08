# Deploy na Vercel

## Pré-requisitos

- Conta na Vercel (https://vercel.com)
- Conta no WalletConnect Cloud (https://cloud.walletconnect.com)
- Contratos deployados na Base Sepolia (já feito!)
- Repositório Git

## IMPORTANTE: Contratos Já Estão Prontos!

Os contratos já foram deployados e o arquivo `packages/nextjs/contracts/deployedContracts.ts` já está commitado no Git.

**Você NÃO precisa rodar `yarn deploy` na Vercel!**

A Vercel vai apenas fazer o build do frontend (`yarn build`) que já inclui os contratos.

## Passo 1: Obter WalletConnect Project ID

1. Acesse https://cloud.walletconnect.com
2. Crie uma conta e faça login
3. Crie um novo projeto
4. Copie o Project ID

## Passo 2: Variáveis de Ambiente

Configure estas variáveis na Vercel:

```
NEXT_PUBLIC_ALCHEMY_API_KEY=8fPGaJqRo5lgdymlTvD6B
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=seu-project-id-aqui
```

Importante: Não adicione PRIVATE_KEY na Vercel.

## Passo 3: Deploy na Vercel

### Via GitHub

1. Push do código para GitHub:
```bash
git init
git add .
git commit -m "Deploy Graze"
git remote add origin https://github.com/seu-usuario/graze.git
git branch -M main
git push -u origin main
```

2. Conectar Vercel:
   - Acesse https://vercel.com
   - Add New Project
   - Import Git Repository
   - Selecione seu repositório

3. Configurar:
   - Framework: Next.js
   - Root Directory: `packages/nextjs`
   - Build Command: `yarn build`
   - Output Directory: `.next`
   - Install Command: `yarn install`

4. Adicionar variáveis de ambiente (Passo 2)

5. Deploy

### Via Vercel CLI

```bash
npm i -g vercel
vercel login
cd packages/nextjs
vercel --prod
```

## Troubleshooting

**Module not found:**
```bash
cd packages/nextjs
yarn install
vercel --prod
```

**Build failed:**
```bash
cd packages/nextjs
yarn build
```

**WalletConnect failed:**
Verifique se NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID está correto.

## Contratos Deployados

Base Sepolia:
- StableToken: `0x8cEE319f762E5A340f2f2EFBbdCf657200498Dfa`
- AgroAsset: `0xd6a816E08f6743d80218cd29954755a5fc59FaE7`
- VaultManager: `0xCCF3dc3aDfB31f22fd24fF3CFEf9711376699240`
- AuctionManager: `0x735496625A564d0535eeF6edA12eb77980517A9F`
- MockBridgeBase: `0xD7D1FE0a2A1B6BB22779F8C0424Cd6139566c261`

Zama Local:
- WStableToken: `0xa513E6E4b8f2a923D98304ec87F64353C4D5C853`
- WAgroAsset: `0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6`
- AuctionManagerFHE: `0x8A791620dd6260079BF849Dc5567aDC3F2FdC318`
