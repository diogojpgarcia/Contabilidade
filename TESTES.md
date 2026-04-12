# ✅ CHECKLIST DE TESTES

## 🔐 Autenticação

### Primeiro Acesso - Utilizador 1 (Diogo)
- [ ] Aparece ecrã de seleção de utilizador
- [ ] Mostram-se 2 cards: Diogo Garcia (DG, azul) e Leila Ferreira (LF, rosa)
- [ ] Ao clicar em Diogo Garcia, vai para escolha de tamanho de PIN
- [ ] Aparece avatar grande com iniciais DG e nome
- [ ] Mostram-se 2 opções: 4 dígitos e 6 dígitos
- [ ] Ao escolher 4 dígitos, aparece input com 4 campos
- [ ] Ao introduzir PIN (ex: 1234), entra automaticamente na app
- [ ] Header mostra avatar pequeno com DG e nome "Diogo Garcia"
- [ ] Botão "Sair" visível no canto superior direito

### Logout e Novo Login
- [ ] Ao clicar em "Sair", volta ao ecrã de seleção de utilizador
- [ ] Ao clicar novamente em Diogo Garcia, pede PIN (não pede escolha de tamanho)
- [ ] Input tem 4 campos (tamanho guardado)
- [ ] Ao introduzir PIN correto (1234), entra na app
- [ ] Ao introduzir PIN errado, mostra erro "PIN incorreto"
- [ ] Campos do PIN ficam vermelhos e fazem animação de shake
- [ ] Pode voltar atrás com botão "← Voltar"

### Segundo Utilizador (Leila)
- [ ] Sair e selecionar Leila Ferreira
- [ ] Escolher 6 dígitos como tamanho do PIN
- [ ] Criar PIN de 6 dígitos (ex: 123456)
- [ ] Entra na app com dados vazios (sem transações do Diogo)
- [ ] Header mostra LF e nome "Leila Ferreira"

### Isolamento de Dados
- [ ] Transações do Diogo não aparecem quando Leila está logada
- [ ] Cada utilizador vê apenas os seus próprios dados
- [ ] PINs são diferentes para cada utilizador

## 💰 Gestão de Transações

### Adicionar Despesa
- [ ] Clicar no botão "+" (canto inferior direito, azul, redondo)
- [ ] Abre formulário em modal
- [ ] Título "Nova Transação" visível
- [ ] Tipo "Despesa" está selecionado (vermelho)
- [ ] Inserir valor: 50.00
- [ ] Selecionar categoria: 🍽 Alimentação
- [ ] Inserir descrição: "Compras Continente"
- [ ] Data pré-preenchida com hoje
- [ ] Clicar em "Adicionar" (botão vermelho)
- [ ] Modal fecha
- [ ] Transação aparece na lista
- [ ] Card da despesa tem ícone 🍽 com cor laranja (#E8734A)
- [ ] Mostra "Alimentação" e descrição "Compras Continente"
- [ ] Valor mostra "-50,00 €" em vermelho
- [ ] Card de resumo "Despesas" atualiza para 50,00 €
- [ ] Saldo atualiza para -50,00 € (vermelho)

### Adicionar Receita
- [ ] Clicar no botão "+"
- [ ] Clicar no botão "Receita" (fica verde)
- [ ] Inserir valor: 1500.00
- [ ] Selecionar categoria: 💰 Salário
- [ ] Não inserir descrição (campo opcional)
- [ ] Clicar em "Adicionar" (botão verde)
- [ ] Transação aparece na lista
- [ ] Card tem ícone 💰 com cor verde (#34D399)
- [ ] Valor mostra "+1.500,00 €" em verde
- [ ] Card "Receitas" atualiza para 1.500,00 €
- [ ] Saldo atualiza para 1.450,00 € (verde, positivo)

### Lista de Transações
- [ ] Transações agrupadas por data
- [ ] Data no formato "11 Abr 2026"
- [ ] Mais recentes aparecem primeiro
- [ ] Cada card mostra: ícone, categoria, descrição (se houver), valor
- [ ] Botão "×" (vermelho claro) visível em cada card ao lado direito

### Eliminar Transação
- [ ] Clicar no botão "×" de uma transação
- [ ] Aparece confirmação: "Tem a certeza que deseja eliminar esta transação?"
- [ ] Clicar em "OK"
- [ ] Transação desaparece da lista
- [ ] Resumo atualiza automaticamente (receitas, despesas, saldo)

### Categorias de Despesa
Adicionar uma transação de cada categoria e verificar ícones/cores:
- [ ] 🍽 Alimentação - Laranja (#E8734A)
- [ ] 🏠 Habitação - Azul (#5B8DEF)
- [ ] 🚗 Transporte - Amarelo (#F5B731)
- [ ] 💊 Saúde - Turquesa (#4ECDC4)
- [ ] 🎭 Lazer - Roxo (#A78BFA)
- [ ] 📚 Educação - Verde (#34D399)
- [ ] 👕 Roupa - Rosa (#F472B6)
- [ ] 💻 Tecnologia - Azul claro (#60A5FA)
- [ ] 📱 Subscrições - Amarelo (#FBBF24)
- [ ] 📦 Outros - Cinzento (#9CA3AF)

## 📊 Dashboard e Resumo

### Cards de Resumo
- [ ] 3 cards visíveis: Receitas, Despesas, Saldo
- [ ] Card Receitas tem borda verde
- [ ] Card Despesas tem borda vermelha
- [ ] Card Saldo tem borda verde (se positivo) ou vermelha (se negativo)
- [ ] Valores formatados corretamente: "1.234,56 €"

### Top 3 Categorias
- [ ] Adicionar despesas em várias categorias
- [ ] Secção "Principais Categorias" aparece
- [ ] Mostra top 3 categorias com mais gastos
- [ ] Cada item mostra: ícone, nome, valor, percentagem
- [ ] Percentagem calculada corretamente (ex: 50%)

### Navegação entre Meses
- [ ] Header mostra "Abril 2026" (mês atual)
- [ ] Setas "‹" e "›" visíveis
- [ ] Clicar em "‹" muda para Março 2026
- [ ] Resumo atualiza (mostra apenas transações de Março)
- [ ] Clicar em "›" volta para Abril
- [ ] Pode navegar para meses futuros
- [ ] Transações aparecem no mês correto

## 💾 Persistência de Dados

### LocalStorage
- [ ] F12 → Application → LocalStorage
- [ ] Verificar existência de:
  - `user_diogo` com campo `pinHash`
  - `transactions_diogo` com array de transações
  - `user_leila` (se criado)
  - `transactions_leila` (se criado)
- [ ] Valores em JSON válido

### SessionStorage
- [ ] Verificar `current_session` com `userId` e `timestamp`

### Reload da Página
- [ ] Adicionar transações
- [ ] Recarregar página (F5)
- [ ] Ainda está logado (não pede PIN novamente)
- [ ] Transações continuam visíveis
- [ ] Resumo está correto

### Logout e Login
- [ ] Fazer logout
- [ ] Fazer login novamente
- [ ] Todas as transações continuam lá
- [ ] Dados persistem entre sessões

### Limpar Dados
- [ ] F12 → Application → LocalStorage
- [ ] Clicar direito → Clear
- [ ] Recarregar página
- [ ] Volta ao ecrã inicial
- [ ] Pode criar novo PIN

## 📱 Responsividade e UX

### Mobile (< 640px)
- [ ] Layout em coluna (cards empilhados)
- [ ] Botão "+" acessível no canto inferior direito
- [ ] Modal de transação ocupa quase toda a tela
- [ ] Inputs grandes o suficiente para touch
- [ ] Não há scroll horizontal

### Tablet (640px - 768px)
- [ ] Layout adapta (mais espaço)
- [ ] Cards de resumo em grid de 3 colunas
- [ ] Tudo legível e espaçado

### Desktop (> 768px)
- [ ] App centralizada com max-width 768px
- [ ] Modal tem border-radius completo (não só em cima)
- [ ] Margens adequadas

### Interações Touch
- [ ] Todos os botões têm área de toque adequada (min 44x44px)
- [ ] Feedback visual ao tocar (hover states)
- [ ] Animações suaves

### Formulário de Transação
- [ ] Modal abre com animação slide-up
- [ ] Fechar com "×" ou clicar fora fecha o modal
- [ ] Toggle Despesa/Receita funciona
- [ ] Cor muda (vermelho/verde) conforme tipo
- [ ] Input numérico abre teclado numérico no mobile
- [ ] Data tem date picker
- [ ] Validação: não deixa submeter sem valor ou categoria
- [ ] Botão "Cancelar" fecha sem guardar

## 🎨 Visual e Dark Theme

### Cores
- [ ] Background principal: #0f172a (azul escuro)
- [ ] Background secundário: #1e293b (azul médio)
- [ ] Texto: #f1f5f9 (branco/cinza claro)
- [ ] Bom contraste (legível)

### Componentes
- [ ] Cards com border-radius arredondado
- [ ] Sombras subtis
- [ ] Ícones emoji grandes e visíveis
- [ ] Gradientes nos botões principais

### Animações
- [ ] PIN error: shake animation
- [ ] Botões: hover e active states
- [ ] Modal: slide-up animation
- [ ] Botão "+": scale ao hover
- [ ] Smooth transitions

## 🔒 Segurança

### PIN Hashing
- [ ] F12 → Application → LocalStorage → user_diogo
- [ ] Campo `pinHash` não mostra PIN em texto simples
- [ ] Valor é hash SHA-256 (64 caracteres hexadecimais)
- [ ] Exemplo: "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"

### Validação
- [ ] Não aceita letras no PIN (só dígitos)
- [ ] Input limita a 1 dígito por campo
- [ ] Paste de PIN funciona (se tiver 4 ou 6 dígitos)
- [ ] PIN errado não dá acesso

## 🌐 PWA Features

### Service Worker (só em produção - npm run build)
- [ ] Build da app: `npm run build`
- [ ] Preview: `npm run preview`
- [ ] Chrome → DevTools → Application → Service Workers
- [ ] Service worker registado e ativo
- [ ] Manifest.json carregado corretamente

### Instalação
- [ ] Chrome mostra ícone de instalação na barra
- [ ] Pode instalar como PWA
- [ ] Ícone aparece no sistema
- [ ] Abre em janela standalone (sem barra do browser)

### Offline (após instalação)
- [ ] Desligar internet
- [ ] App continua a abrir
- [ ] Dados continuam acessíveis (localStorage)
- [ ] Funcionalidades básicas funcionam

## ❌ Casos de Erro

### Estado Vazio
- [ ] Sem transações: mostra "Ainda não há transações" com ícone 📝
- [ ] Mensagem: "Clique no botão + para adicionar"

### Inputs Inválidos
- [ ] Formulário sem valor: não submete
- [ ] Formulário sem categoria: não submete
- [ ] Valor negativo: aceita? (deve aceitar, mostra absoluto)
- [ ] Data futura: aceita (limite é data de hoje)

### PIN
- [ ] 3 dígitos num PIN de 4: não submete automaticamente
- [ ] Paste de texto (não-dígitos): ignora
- [ ] Paste de 5 dígitos num campo de 4: pega só os primeiros 4

## 🚀 Performance

### Carregamento
- [ ] App carrega em < 2 segundos (primeira vez)
- [ ] Navegação entre ecrãs é instantânea
- [ ] Sem flickering ou layout shifts

### Memória
- [ ] Sem memory leaks (testar com 100+ transações)
- [ ] Scroll suave mesmo com muitas transações

## 📋 Resultado Final

**Total de testes**: ~100
**Testes passados**: ___ / 100
**Testes falhados**: ___

### Issues Encontrados:
1. 
2. 
3. 

### Melhorias Sugeridas:
1. 
2. 
3. 

---

**Testado por**: ________________
**Data**: ________________
**Versão**: 1.0.0
**Browser**: ________________
**OS**: ________________
**Device**: ________________
