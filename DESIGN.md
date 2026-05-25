---
name: Sistema AJMG
description: ERP unificado da AJMG Construtora — moderno, eficiente, calmo. Preto, branco, azul-escuro. Never green.
colors:
  concrete-black: "#0B1020"
  steel-gray: "#5A6072"
  site-gray: "#6B7280"
  cool-paper: "#F4F5F9"
  bright-white: "#FFFFFF"
  hairline: "#E7E9F1"
  construction-navy: "#14224F"
  construction-navy-deep: "#1B2E68"
  steel-cobalt: "#2F55F2"
  cement-mist: "#EEF1FD"
  site-night: "#0E1430"
  rose-warn: "#E11D48"
  amber-warn: "#F59E0B"
  emerald-ok: "#10B981"
typography:
  display:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.7rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Hanken Grotesk, ui-sans-serif, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.14em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "18px"
  3xl: "22px"
  4xl: "26px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
  3xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.construction-navy}"
    textColor: "{colors.bright-white}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
    typography: "{typography.title}"
  button-primary-hover:
    backgroundColor: "{colors.construction-navy-deep}"
    textColor: "{colors.bright-white}"
  button-outline:
    backgroundColor: "{colors.bright-white}"
    textColor: "{colors.concrete-black}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.steel-gray}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.bright-white}"
    rounded: "{rounded.2xl}"
    padding: "16px"
  input:
    backgroundColor: "{colors.bright-white}"
    textColor: "{colors.concrete-black}"
    rounded: "{rounded.xl}"
    padding: "0 14px"
    height: "40px"
  badge-status:
    backgroundColor: "{colors.cool-paper}"
    textColor: "{colors.steel-gray}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
    typography: "{typography.label}"
  sidebar:
    backgroundColor: "{colors.site-night}"
    textColor: "{colors.bright-white}"
    width: "256px"
---

# Design System: Sistema AJMG

## 1. Overview

**Creative North Star: "The Quiet Workhorse"**

A ferramenta vive ao lado do trabalho — não compete com ele. Onde a maioria dos ERPs grita (gradientes, ícones gigantes, ondas de cor), este sistema fica calado e faz. Tipografia carrega o peso visual; cor é usada com economia; espaços brancos respiram. A inspiração estética é uma mesa de engenheiro organizada às seis da manhã: documentos limpos, marcações nos lugares certos, nada decorativo.

A AJMG vende imóveis de R$ 100-200 mil em Goiás. O sistema é interno (vendedores, gestores, responsável de manutenção) — não há cliente final assistindo. Por isso a estética **rejeita explicitamente**: corporatês-frio de banco (cinza chapado, formulários de bancário), cafonice colorida de ERP brasileiro antigo (verde berrante, gradientes laranja), shadcn default AI-made (cards uniformes com emojis aleatórios), e marketinguês de SaaS-startup (hero gradients, "transforme seu negócio"). O resultado é silencioso mas não blando — tem personalidade pela ausência de ruído, não pela presença de glitter.

**Key Characteristics:**

- **Tipografia faz o trabalho pesado.** Bricolage Grotesque (display) + Hanken Grotesk (body). Pareamento moderno, sem fontes safe.
- **Paleta restrita.** Concrete Black, Construction Navy, Steel Cobalt, Cool Paper, Hairline. Cinco tons fazem 95% do sistema.
- **Mobile primeiro onde o trabalho acontece.** Vendedores no campo e Omar nas obras vivem no celular. Touch targets ≥ 44px, modais que cabem em iPhone SE.
- **Flat por padrão.** Sombras só como resposta a interação (hover, focus). Profundidade vem por tonal layering.
- **PT-BR coloquial-profissional.** "A fazer", "Fazendo", "Feita". Não "Pendente", "Em processamento", "Finalizado".

## 2. Colors

A paleta evoca canteiro de obra antes do amanhecer: concreto fresco, aço, marcação de tinta azul. Cinco tons fazem o sistema; o resto é roxo-azulado-suporte (warnings) usado com extrema parcimônia.

### Primary

- **Construction Navy** (`#14224F`): cor de qualquer ação primária — botão "Novo", "Salvar", links principais. Saturada o suficiente pra puxar o olho, escura o suficiente pra parecer institucional. Não é azul-de-faceblock; é azul de planta arquitetônica.
- **Construction Navy Deep** (`#1B2E68`): variante hover/active do Navy. Aprofunda 8% sem mudar de hue.
- **Steel Cobalt** (`#2F55F2`): accent de alta energia — focus rings, etapas selecionadas, ícones ativos, indicadores de drop no Kanban. Usado com **a regra dos 10%**: nunca mais que isso por tela.

### Neutral

- **Concrete Black** (`#0B1020`): texto primário. Quase-preto com sombra de navy. Nunca usar `#000` puro — concreto também tem alma.
- **Steel Gray** (`#5A6072`): texto secundário, metadados, descrições truncadas.
- **Site Gray** (`#6B7280`): placeholders, labels muted. ≥4.5:1 contrast em fundo branco (testado).
- **Hairline** (`#E7E9F1`): bordas, dividers. Visível mas invisível — separa sem gritar.
- **Cool Paper** (`#F4F5F9`): background da aplicação. Não branco puro — concrete-tinted neutral.
- **Bright White** (`#FFFFFF`): cards, modais, surfaces elevadas tonalmente.
- **Cement Mist** (`#EEF1FD`): chips ativos, badges selecionados, fundo de ações destacadas. Forma soft contrast com Navy/Cobalt.
- **Site Night** (`#0E1430`): exclusivo do sidebar. Cria contraste estrutural entre navegação e conteúdo. Texto sobre Site Night é branco a 90% (`rgba(255,255,255,0.9)`).

### Support (use raro)

- **Rose Warn** (`#E11D48`): atrasos, deleção, erros. Usar só pra estado real — nunca decorativo.
- **Amber Warn** (`#F59E0B`): prioridade média, atenção sem urgência.
- **Emerald OK** (`#10B981`): conclusão, sucesso. Usado **apenas em check de tarefa concluída** e badges de "Concluídas". Nunca em CTA, nunca em hero. **NUNCA verde saturado em qualquer outro lugar.**

### Named Rules

**The 10% Cobalt Rule.** Steel Cobalt (`#2F55F2`) nunca cobre mais que 10% da superfície visível de uma tela. Sua raridade é o que faz ele puxar atenção.

**The No-Green Rule.** Verde só existe como confirmação pontual (Emerald OK em check de tarefa feita). Nenhum botão, fundo, hover, badge ou ilustração usa verde saturado. Construtora ≠ agritech.

**The Hairline-First Rule.** Antes de adicionar sombra, fundo, ou cor, tente Hairline (`#E7E9F1`). Se Hairline resolve, pare aí.

## 3. Typography

**Display Font:** Bricolage Grotesque (Google Fonts) — pesos 500, 600, 700, 800
**Body Font:** Hanken Grotesk (Google Fonts) — pesos 400, 500, 600, 700

**Character:** Bricolage tem ossatura geométrica com toques humanistas — não-corporativo, contemporâneo, brasileiro-friendly. Hanken é o seu vizinho funcional: legível em qualquer tamanho, sem personalidade competindo. Juntos: voz de quem escreve documento técnico mas não é robô.

### Hierarchy

- **Display** (700, `1.7rem` / `27px`, line-height 1, tracking `-0.02em`): título principal de cada página no `<Header>`. Aparece uma vez por tela.
- **Headline** (700, `1.125rem` / `18px`, line-height 1.2): seções principais dentro de uma página, títulos de modal.
- **Title** (600, `0.9375rem` / `15px`, line-height 1.3): títulos de cards (TaskCard, KanbanCard), nome do cliente em lista.
- **Body** (400, `0.875rem` / `14px`, line-height 1.5): texto corrido, descrições, copy de UI. Cap de linha em 65-75ch.
- **Label** (700, `0.6875rem` / `11px`, uppercase, tracking `0.14em`): labels de formulário, eyebrows de seção, badges. O uppercase + tracking é o que dá estrutura visual ao formulário.

### Named Rules

**The Weight-Over-Size Rule.** Hierarquia se faz por peso (400 → 600 → 700) antes de tamanho. Múltiplas escalas amontoadas são ruído; pesos distintos no mesmo tamanho criam ritmo.

**The Bricolage-Display-Only Rule.** Bricolage é display. Apareceu em parágrafo de body? Errado — trocar pra Hanken.

## 4. Elevation

Sistema é **flat por padrão**. Surfaces não flutuam em repouso. Profundidade vem por **tonal layering**: o app fica em Cool Paper, cards são Bright White, sidebar é Site Night, chips ativos viram Cement Mist. Isso já cria 4 camadas sem sombra nenhuma.

Sombras existem mas são reação a interação — nunca decorativa, nunca ambiente.

### Shadow Vocabulary

- **Hover lift** (`box-shadow: 0 1px 3px rgba(11, 16, 32, 0.06), 0 1px 2px rgba(11, 16, 32, 0.04)`): aparece no hover de cards clicáveis, botões primários. Sutil, frio (sombra com tint de Concrete Black).
- **Modal/dialog** (`box-shadow: 0 8px 32px rgba(11, 16, 32, 0.12)`): exclusivo de overlays. Mais difuso pra criar separação real.
- **Focus ring** (`box-shadow: 0 0 0 3px rgba(47, 85, 242, 0.15)`): focus visible em inputs e botões. Cobalt diluído.

### Named Rules

**The Flat-By-Default Rule.** Em repouso, zero sombra. Sombra só aparece como resposta a hover, focus, ou em elementos que precisam genuinamente sair do plano (modais).

**The Tonal-Layer Rule.** Antes de adicionar sombra pra separar, mude a cor do background. Paper → White, White → Cement Mist são separadores tão fortes quanto sombra, sem o custo visual.

## 5. Components

### Buttons

- **Shape:** retângulo arredondado, `rounded-xl` (14px). Suficiente pra parecer contemporâneo, longe de pill.
- **Primary:** Construction Navy bg + Bright White texto, padding `10px 16px`, peso 600. Hover desce 8% pra Construction Navy Deep. Transição 200ms ease-out.
- **Outline:** Bright White bg + Concrete Black texto + Hairline border. Hover puxa border pra Construction Navy a 40%.
- **Ghost:** transparent bg + Steel Gray texto. Hover usa Cool Paper bg + Concrete Black texto. Usado em ações secundárias e ícones de tabela.
- **Focus:** ring Cobalt a 15% (3px). Nunca remover focus visível.

### Cards

- **Corner Style:** `rounded-2xl` (18px) — generoso, característico. Cards reconhecíveis à distância pelo arredondamento.
- **Background:** Bright White sobre Cool Paper. Sem sombra em repouso. Border `1px solid Hairline`.
- **Hover (se clicável):** border vira `Construction Navy / 40%`, ganha Hover lift shadow. Transição 200ms ease-out.
- **Internal Padding:** `16px` (lg). Em cards do Kanban, altura fixa de `176px` pra padronização visual.

### Inputs

- **Style:** `rounded-xl` (14px), height `40px` (mobile-friendly), border `1px Hairline`, bg Bright White, padding horizontal `14px`.
- **Focus:** border vira Construction Navy + focus ring Cobalt 15%.
- **Disabled:** opacity 50%, cursor not-allowed. Sem mudança de cor adicional.

### Segmented Control

Padrão de troca entre opções poucas (Hoje/Atrasadas/Próximos, Prioridade, Status no form). Distintivo do sistema.

- **Container:** `rounded-2xl` (18px), bg Cool Paper, padding interno `4px`. Hairline border.
- **Item ativo:** Bright White bg, sombra hover lift, ring interno Hairline.
- **Item inativo:** Steel Gray texto, transparent bg. Hover puxa pra Concrete Black.
- **Badges de contagem dentro do segmented:** chip pill com cor contextual (rose pra atrasada, emerald pra concluída, brand-tint pra padrão).

### Sidebar

Surface escura, contraste estrutural com o conteúdo. Compromisso com modo escuro **apenas no sidebar** — corpo do app é sempre claro.

- **Background:** Site Night (`#0E1430`).
- **Logo:** chip Cobalt arredondado (`rounded-2xl`) com sombra leve de Cobalt no fundo. Texto à direita do logo em branco display.
- **Item ativo:** bg Cobalt sólido + sombra Cobalt 25%, texto branco 600.
- **Item inativo:** texto branco 50%. Hover sobe pra branco 100% + bg `white/0.04`.
- **Módulo desabilitado:** texto branco 30%, badge "Em breve" minúsculo.
- **Mobile:** vira drawer com backdrop `rgba(0,0,0,0.6)` + blur leve.

### Header (page-level)

- **Sticky** com `backdrop-blur-xl` e bg surface/85%.
- **Eyebrow** (label uppercase em Cobalt): identifica o módulo.
- **Title** (display 1.7rem): nome da página.
- **Subtitle** opcional (body): contexto.
- **Actions** à direita: filtros + CTA primário.

### Status Badges

Pequenas pílulas (`rounded-pill`, padding `2px 8px`, label typography). Cor contextual:

- A fazer: Cool Paper bg + Steel Gray texto
- Em andamento: blue-50 bg + blue-700 texto
- Concluída: emerald-50 bg + emerald-700 texto
- Atrasada (urgência): rose-50 bg + rose-700 texto

## 6. Do's and Don'ts

### Do:

- **Do** usar **Construction Navy** (`#14224F`) em ações primárias (CTAs, "Salvar", "Novo"). Steel Cobalt fica pra accent (focus, etapas ativas, drops do Kanban).
- **Do** abrir cada tela com `<Header>` contendo eyebrow (label uppercase em Cobalt), title (display) e actions à direita.
- **Do** truncar descrições em cards com `line-clamp-2` ou `line-clamp-3`. Quem quer ler completo abre o modal.
- **Do** manter altura padronizada em cards de listas (`h-44` no Kanban). Layout calmo precisa de ritmo previsível.
- **Do** usar **tonal layering** antes de sombra: Paper → White → Cement Mist resolve 80% dos casos.
- **Do** segmented controls pra escolhas pequenas (≤3 opções). Selects pra listas longas.
- **Do** PT-BR coloquial-profissional em UI copy: "A fazer", "Fazendo", "Feita", "Atrasada". Nada de "Pendente", "Em processamento".
- **Do** garantir **focus ring visível** (ring Cobalt 15% / 3px) em qualquer interativo.
- **Do** botões e touch targets `≥ 44×44px` onde Omar ou vendedores vão tocar — listas, cards, ícones de ação.

### Don't:

- **Don't** usar **verde saturado** em hover, CTAs, badges, hero, gradients. Verde só existe em Emerald OK pontual (check de tarefa feita). Construtora ≠ agritech.
- **Don't** usar **`#000` puro ou `#fff` puro** — sempre tintar com hue do brand (Concrete Black, Bright White).
- **Don't** colocar **gradients dramáticos**, ondas de cor, hero saturado. Isso é landing-page, este é product.
- **Don't** usar **emojis em headings** ou labels de seção (📊 Análise). Ícone monocromático Lucide ao lado quando ajuda; emoji nunca.
- **Don't** ter **cards uniformes sem identidade** (shadcn default look). Variar peso de tipografia, hierarquia, e detalhes contextuais (categoria com cor própria, prioridade dot, badge atrasada).
- **Don't** escrever **microcopy paternalista** ("Por favor, preencha todos os campos obrigatórios"). Direto: "Faltou nome", "Telefone obrigatório".
- **Don't** **sombras em repouso**. Surface flutua só em interação (hover/focus) ou em overlay genuíno (modal, popover).
- **Don't** usar **bordas laterais coloridas** (border-left de 3px+ como accent stripe). Use full border ou nenhuma.
- **Don't** gradient em texto (`background-clip: text`). Cor sólida, peso/tamanho carregam ênfase.
- **Don't** usar **emojis no copy do produto**, mesmo quando "fica simpático". Ferramenta interna não é WhatsApp.
- **Don't** "transforme seu fluxo", "powered by AI", "revolução na gestão". É ferramenta interna — usuário já entrou.
