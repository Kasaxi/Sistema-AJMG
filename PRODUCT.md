# Product

## Register

product

## Users

ERP interno da **AJMG Construtora** (construtora em Goiás que vende imóveis novos e usados). O sistema atende 4 perfis distintos, em estágios diferentes de adoção:

- **Administradores (Nilson, Wesley):** gestores que precisam de visão completa — vendas, equipe, obras, financeiro. Trabalham misturando desktop e mobile, ritmo intenso, decidem rápido.
- **Vendedores (~10 no roadmap):** atuam no campo. Cadastram clientes, atualizam status, mandam follow-up — quase tudo pelo celular, durante visitas e ligações. Touch targets confortáveis e telas que carregam rápido em 4G são essenciais.
- **Colaboradores escopados (Omar — responsável de manutenção/obras):** acessam apenas o módulo que precisam (ex.: Omar só vê Agenda). Vão usar o sistema na obra, fotografando, anexando vídeos, anotando vistorias pelo celular.
- **Equipe administrativa/financeira (próximos 12 meses):** vai operar contas a pagar, contas a receber, conciliação. Trabalho de escritório, desktop principalmente.
- **Fornecedores (surface futura):** vão enviar orçamentos em PDF. O sistema (com Claude) extrai dados automaticamente pra comparar propostas. Acesso pontual, externo.

## Product Purpose

Consolidar **4 sistemas legados** (Neon/Prisma, Appwrite, Appwrite, Sheets) que hoje rodam em paralelo numa **única plataforma**. A empresa perdia tempo pulando entre ferramentas, com dados duplicados, contas separadas, autenticação fragmentada.

O sistema cobre **7 módulos** integrados:
1. Vendas (CRM imobiliário) — em uso
2. Agenda (tarefas + agendamentos com anexos) — em uso
3. Obras (cadastro central) — próximo
4. Compras/Gastos de obra — próximo
5. RH/Ponto
6. Financeiro (consolidador)
7. Cobrança (régua de inadimplência)

Sucesso = parar de pular entre ferramentas, source-of-truth único, dados confiáveis em qualquer dispositivo.

## Brand Personality

**Moderno · eficiente · calmo.**

O sistema deve transmitir solidez sem ser frio. Construtora vende imóveis caros — o time precisa parecer organizado e profissional, mas o cliente final nunca vê o sistema. O foco é a **eficiência interna**. Calmo significa: tela limpa, sem ruído, sem decoração que distrai, sem urgência fabricada. Eficiente significa: tudo a um clique, dados onde você espera, atalhos quando faz sentido. Moderno significa: parece de 2026, não de 2014 — mas sem virar showroom de design.

## Anti-references

Lista do que o sistema **não** pode parecer. Quatro armadilhas mapeadas:

- **Corporatês-frio de banco** (sistemas estilo PJBank, sistemas antigos de bancário): cinza padrão chapado, fontes ruins, formulários genéricos, layouts engessados, "Prezado usuário".
- **Cafonice colorida de ERP antigo brasileiro**: verde berrante, vermelho gritante, gradientes laranja, layouts poluídos. Telas que parecem dashboard de 2008.
- **Shadcn default / AI-made**: cards uniformes sem identidade, paleta cinza-azul-escuro com toques pastel, emojis aleatórios em headings (📊 Análise), microinstrução óbvia em toda label. Cara de "gerado por IA em 5 minutos".
- **SaaS-startup marketinguês**: gradients dramáticos em hero, copywriting "transforme seu negócio", testimonials, ondas de cor. Isso é pra landing — não pra ferramenta interna.

**Cor proibida:** verde em qualquer tom saturado. A referência visual é Abacate Pay recolorido em **preto/branco/azul-escuro**.

## Design Principles

Princípios estratégicos pra orientar decisões — não regras visuais (essas vivem no DESIGN.md).

1. **Consolidação acima de novidade.** Substituir fluxo manual existente vale mais que adicionar feature nova. Cada módulo só entra no ar quando elimina dor real (Sheets, Appwrite, etc).
2. **Mobile é primeira classe onde o trabalho acontece.** Vendedores e Omar vivem no celular. Listas tocáveis, modais que cabem, botões grandes, câmera nativa. Desktop é importante mas não é "o" cenário.
3. **Calmo, não silencioso.** Sem ruído visual, mas com personalidade. Tipografia com peso, hierarquia clara, cor usada com propósito (não decorativa). Sem ser blando.
4. **Direto: sem marketing dentro do produto.** Nada de "transforme seu time" ou "powered by AI". O usuário já entrou — não precisa ser convencido. Microcopy curto, em PT-BR coloquial-profissional ("A fazer", "Fazendo", "Feita" — não "Pendente", "Em processamento", "Finalizado").
5. **Construtora real, não SaaS genérica.** O sistema lembra que estamos lidando com casas de R$ 100-200 mil, contratos longos, gente real. Não é Notion. Não é Linear. É a versão competente dessa categoria pro mercado imobiliário brasileiro.

## Accessibility & Inclusion

- **WCAG 2.1 AA** como mínimo. Contraste 4.5:1 em texto corrido, 3:1 em texto grande/elementos não-texto.
- **Touch targets ≥ 44×44px** em qualquer botão que vendedores ou Omar vão usar no campo.
- **Sem dependência exclusiva de cor** pra status (sempre acompanhado de label + ícone/badge).
- **Sem requisito de assistive tech específico** identificado no time atual. Manter semântica HTML correta (botões são `<button>`, links são `<a>`) é o mínimo de boa cidadania.
