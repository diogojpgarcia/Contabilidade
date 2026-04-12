# 🚀 GUIA DE INSTALAÇÃO - Finanças v3.0

## 📦 O Que Vais Receber

Um ZIP completo com:
- ✅ Sistema de segurança avançado
- ✅ 30+ categorias profissionais
- ✅ Dashboard com gráficos
- ✅ Backup/recuperação completo
- ✅ Tudo pronto para deploy!

---

## ⚡ INSTALAÇÃO RÁPIDA (5 minutos)

### Passo 1: Extrair o ZIP
```
financas-app-v3-professional.zip
```

### Passo 2: Instalar Dependências
```bash
cd financas-app-v3
npm install
```

### Passo 3: Testar Localmente (Opcional)
```bash
npm run dev
```
Abre: http://localhost:5173

### Passo 4: Fazer Deploy no Vercel

**Opção A: GitHub + Vercel (Recomendado)**
```bash
# 1. Criar repo GitHub (se ainda não tens)
git init
git add .
git commit -m "v3.0: Professional Edition"
git remote add origin https://github.com/diogojpgarcia/Contabilidade.git
git branch -M main
git push -f origin main

# 2. Vercel Dashboard
# - vai a vercel.com
# - Import GitHub repo
# - Deploy automático!
```

**Opção B: Vercel CLI**
```bash
vercel --prod
```

---

## 🔄 ATUALIZAR DE v2.0 para v3.0

### ⚠️ IMPORTANTE: Faz Backup Primeiro!

**Se tens dados na v2.0:**

1. **Exporta os dados atuais** (se possível):
   - Abre a app v2.0
   - Se tiver botão de export, exporta
   - Ou anota as transações mais importantes

2. **Método de Atualização**:

#### Opção 1: Substituição Completa (Mais Simples)
```bash
# 1. Backup do repo atual
cd ~/caminho/Contabilidade
cd ..
cp -r Contabilidade Contabilidade_v2_backup

# 2. Substitui com v3.0
cd Contabilidade
rm -rf *  # Apaga tudo EXCETO .git
cd ..
unzip financas-app-v3-professional.zip
cp -r financas-app-v3/* Contabilidade/

# 3. Commit e push
cd Contabilidade
git add .
git commit -m "Upgrade to v3.0 Professional Edition"
git push origin main

# 4. Vercel faz deploy automático!
```

#### Opção 2: Branch Separada (Mais Seguro)
```bash
# 1. Criar branch nova
cd Contabilidade
git checkout -b v3-professional

# 2. Substituir ficheiros
# (copiar da v3.0)

# 3. Commit
git add .
git commit -m "v3.0: Professional Edition"
git push origin v3-professional

# 4. Testar deploy da branch
# Vercel → Create new deployment from branch

# 5. Se estiver OK, merge para main
git checkout main
git merge v3-professional
git push origin main
```

---

## 🎯 PRIMEIRA UTILIZAÇÃO

### 1. Aceder à App
Abre o link do Vercel (ex: `contabilidade.vercel.app`)

### 2. Escolher Utilizador
- Diogo Garcia (DG, azul)
- Leila Ferreira (LF, rosa)

### 3. Setup de Segurança (NOVO!)

**a) Criar PIN**
- Escolhe 4 ou 6 dígitos
- Introduz o PIN

**b) Pergunta de Segurança**
- Escolhe uma pergunta
- Define resposta (memoriza!)
- Confirma resposta

**c) Código de Recuperação**
- Aparece código: XX-XXXX-XXXX
- **SUPER IMPORTANTE: GUARDA ESTE CÓDIGO!**
- Copia para:
  - ✅ Papel (guarda em sítio seguro)
  - ✅ Password manager (1Password, Bitwarden, etc)
  - ✅ Ficheiro de texto encriptado
- **SEM ESTE CÓDIGO não há recuperação total!**

**d) Marca as caixas**
- ✅ Guardei o código
- ✅ Compreendo a importância

**e) Concluir**
- Pronto! Estás dentro! 🎉

### 4. Adicionar Primeira Transação

**Interface Nova:**
- Clica no botão **+** (canto inferior direito)
- **Tipo**: Despesa ou Receita
- **Valor**: Escreve ou usa botões rápidos (5€, 10€, 20€...)
- **Categoria**: Grid visual com ícones grandes
- **Subcategoria**: Aparece automaticamente (ex: Alimentação → Supermercado)
- **Descrição**: Opcional
- **Data**: Pre-preenchida com hoje
- Clica **✓ Adicionar**

### 5. Explorar Dashboard

**Novo na v3.0:**
- 📊 **Gráfico de Pizza**: Ver distribuição de gastos
- 📈 **Gráfico de Barras**: Evolução 6 meses
- 💰 **Taxa de Poupança**: Cálculo automático
- 💡 **Sugestões**: Dicas inteligentes
- 📊 **Estatísticas**: Categorias ativas, total transações, médias

---

## 🔐 USAR SISTEMA DE SEGURANÇA

### Fazer Backup Manual
1. Settings (ícone ⚙️ ou menu)
2. **"Backup & Recuperação"**
3. **"Exportar para Ficheiro"**
4. Download ficheiro `.encrypted`
5. Guarda em:
   - Cloud (Google Drive, Dropbox)
   - Disco externo
   - Email para ti próprio

### Restaurar de Backup
1. **"Importar de Ficheiro"**
2. Escolhe ficheiro `.encrypted`
3. Introduz código de recuperação
4. Dados restaurados! ✅

### Se Esqueceres o PIN

**Método 1: Pergunta Secreta**
1. Login → **"Esqueci o PIN"**
2. **"Pergunta de Segurança"**
3. Responde
4. Cria novo PIN

**Método 2: Código de Recuperação**
1. Login → **"Esqueci o PIN"**
2. **"Código de Recuperação"**
3. Introduz: XX-XXXX-XXXX
4. Cria novo PIN

---

## 🆘 PROBLEMAS COMUNS

### "npm install" dá erros
```bash
# Limpa tudo e reinstala
rm -rf node_modules package-lock.json
npm install
```

### App não inicia (npm run dev)
```bash
# Verifica versão Node.js
node --version  # Deve ser v18+

# Se antiga, atualiza:
# https://nodejs.org
```

### Vercel não faz deploy
1. Vercel Dashboard → Settings → Git
2. Verifica se repo está conectado
3. Force redeploy manualmente
4. Vê logs de build para erros

### Perdeste o código de recuperação
- ❌ Sem código + sem backup = **dados perdidos**
- ✅ **SEMPRE guarda backups manuais regularmente!**

### Transações desapareceram
1. Verifica se estás no utilizador correto (Diogo/Leila)
2. Verifica se estás no mês correto
3. Restaura de backup se necessário

### "Quota exceeded" (LocalStorage cheio)
- Browser tem limite ~5-10MB
- Exporta dados antigos
- Apaga transações muito antigas
- Ou usa novo perfil de browser

---

## 💡 DICAS PRO

### 1. Backups Regulares
- Exporta dados **mensalmente**
- Guarda em 2 locais diferentes
- Nome ficheiros: `backup_YYYY-MM-DD.encrypted`

### 2. Código de Recuperação
- Guarda em **3 locais**:
  1. Papel em casa
  2. Password manager
  3. Email/Cloud encriptado

### 3. Categorias
- Usa subcategorias para detalhe
- Alimentação → Supermercado vs Restaurantes
- Transporte → Combustível vs Uber

### 4. Descrições
- Adiciona sempre que útil
- Ex: "Pingo Doce - compras semana"
- Facilita pesquisa futura

### 5. Dashboard
- Alterna entre gráficos (📊/📈)
- Usa estatísticas para insights
- Compara meses para tendências

---

## 📊 VERIFICAÇÃO PÓS-INSTALAÇÃO

Testa estas funcionalidades:

- [ ] Login com PIN funciona
- [ ] Recuperação de PIN (testa com utilizador teste)
- [ ] Adicionar despesa com subcategoria
- [ ] Adicionar receita
- [ ] Ver gráfico de pizza
- [ ] Ver gráfico de barras (evolução)
- [ ] Taxa de poupança aparece
- [ ] Sugestões inteligentes (após várias transações)
- [ ] Exportar backup funciona
- [ ] Importar backup funciona
- [ ] Navegação entre meses
- [ ] Eliminação de transações
- [ ] Botões de valor rápido (5€, 10€, etc)

---

## 🎯 PRÓXIMOS PASSOS

1. **Usa diariamente** por 1 semana
2. **Adiciona transações reais**
3. **Explora todas as categorias**
4. **Faz backup manual** após 1 semana
5. **Testa recuperação** num browser diferente
6. **Partilha** com família (Leila cria o PIN dela)

---

## 📞 SUPORTE

- **GitHub Issues**: https://github.com/diogojpgarcia/Contabilidade/issues
- **Documentação**: Ver README-V3.md

---

## 🎉 PARABÉNS!

Tens agora uma app de finanças **profissional** com:
- ✅ Segurança bancária
- ✅ 30+ categorias
- ✅ Análise inteligente
- ✅ Gráficos bonitos
- ✅ Backup robusto

**Aproveita! 💪💰**
