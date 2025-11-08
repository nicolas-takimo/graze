# Documento de Design System — Graze (MVP)

## 1) Paleta de cores

* Primária: **Graze Green** — `#4CAF50`
  Uso: botões primários, links de ação, indicadores positivos.
* Secundária: **Soil Brown** — `#7B5E3B`
  Uso: ícones, bordas sutis, elementos de apoio.
* Acento/Destaque: **Harvest Gold** — `#FFC107`
  Uso: métricas em evidência, badges e highlights.
* Fundo (Claro): **Field Mist** — `#F8F9FA`
* Fundo (Escuro): **Night Soil** — `#121212`
* Texto (Claro): primário `#212121`, secundário `#616161`, desabilitado `#9E9E9E`
* Texto (Escuro): primário `#E0E0E0`, secundário `#BDBDBD`, desabilitado `#8D8D8D`
* Status: sucesso `#00C853`, erro `#D32F2F`, aviso `#FFA000`, informação `#29B6F6`
* Divisores/Bordas: **Clay** — `#E0E0E0` (claro) / `#2C2C2C` (escuro)

## 2) Tipografia

* Fontes:

  * Títulos e corpo: **Inter**, fallback sans-serif (compatível com Scaffold-ETH)
  * Monoespaçada: **JetBrains Mono**, fallback monospace (endereços, hashes)
* Tamanhos:

  * H1: 32px, line-height 120%, peso 700
  * H2: 24px, line-height 130%, peso 600
  * H3: 20px, line-height 140%, peso 600
  * Body: 16px, line-height 150%, peso 400
  * Small: 14px, line-height 160%, peso 400
* Regras:

  * Máx. 2 pesos por tela para performance.
  * Manter contraste WCAG 2.1 AA mínimo.

## 3) Sistema de espaçamento

* Escala base (multiplo de 4):
  `xs=4px`, `sm=8px`, `md=16px`, `lg=24px`, `xl=32px`, `2xl=48px`
* Padrões:

  * Padding de cards/inputs: `md`
  * Gaps entre componentes: `md`
  * Margens externas de seções: `xl`
  * Layouts em grid: múltiplos de 8px (coeso com Tailwind/Scaffold-ETH)

## 4) Tokens visuais e temas

* Radius:

  * Botões/inputs/cards: 8px
  * Modais/containers: 16px
* Sombras:

  * Claro: `0 2px 8px rgba(0,0,0,0.1)`
  * Escuro: `0 2px 8px rgba(0,0,0,0.4)`
* Gradiente opcional de destaque:

  * `linear-gradient(90deg, #4CAF50 0%, #7B5E3B 100%)`
* Transições:

  * `all 0.2s ease-in-out` (hover, focus, abrir/fechar modal)
* Estados de interação:

  * Botão primário: hover = escurecer ~8% + sombra levemente maior; active = escurecer ~16% + sombra menor; disabled = opacidade 40%
  * Input: focus com borda `#4CAF50`; erro com borda `#D32F2F`
  * Skeletons:

    * Claro: blocos entre `#E0E0E0` e `#F8F9FA`
    * Escuro: blocos entre `#2C2C2C` e `#1E1E1E`
  * Loaders: spinner circular 24px com `#4CAF50`
* Modo escuro:

  * Fundo: `#121212`; superfícies: `#1E1E1E`
  * Texto: primário `#E0E0E0`, secundário `#BDBDBD`
  * Bordas: `#2C2C2C`
  * Acento consistente: `#4CAF50`
  * Hovers: aumentar brilho em ~8%

## 5) Responsividade

* sm (≤640px): layout empilhado; 1 card por linha; header compacto
* md (641–1024px): 2 cards por linha; filtros resumidos
* lg (≥1025px): 3–4 cards por linha; espaçamentos `lg`/`xl`
* xl (≥1440px): painéis amplos; tabelas/grades full-width com gaps maiores

## 6) Mapeamento para Tailwind/Scaffold-ETH (sugestão)

* Cores (Tailwind config): mapear `primary`, `secondary`, `accent`, `success`, `error`, `warning`, `info`, `surface`, `text` claro/escuro.
* Fontes: `font-sans` = Inter; `font-mono` = JetBrains Mono.
* Radius: `rounded-md` = 8px; `rounded-xl` = 16px.
* Spaces: usar `p-4` (16px), `p-6` (24px), `p-8` (32px) como padrões de bloco.
* Sombras: `shadow` (claro), `shadow-lg` (destaque); custom em `tailwind.config.js` para dark.

## 7) Princípios de uso

* Minimalismo: poucos tons, sem “poluição visual”.
* Hierarquia clara: H1 para títulos de página, H2/H3 para seções e cards.
* Feedback imediato: toasts e estados de botão (loading/disabled) em ações on-chain.
* Consistência: mesmos tokens em Dashboard, Detalhe do Leilão, Minhas Operações e Vault.
* Acessibilidade: tamanho mínimo de fonte 14px; foco visível; contraste garantido.
