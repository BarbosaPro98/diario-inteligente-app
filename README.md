# Diário Seguro — Pessoal & Estratégico

PWA de diário com criptografia local (Next.js 16 + TypeScript + Tailwind CSS 4). Nada sai do dispositivo.

## Rodar

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # gera o site estático em out/ (PWA offline)
npx serve out        # testar o build
```

O build é estático (`output: "export"`): pode ser hospedado em Vercel, Netlify, GitHub Pages ou qualquer servidor HTTPS.
WebAuthn, microfone e service worker exigem HTTPS (ou `localhost`).

## Funcionalidades

- **Tranca master**: PIN de 4 a 6 dígitos ou senha; espera progressiva após 5 erros; auto-lock (1/5/15/30 min) e bloqueio ao minimizar.
- **Biometria (WebAuthn + PRF)**: Touch ID / Face ID / Windows Hello. A extensão PRF gera um segredo que embrulha a chave do diário, então a biometria desbloqueia de verdade em vez de ser só uma tela. Em navegadores sem PRF a opção não é oferecida e vale o PIN.
- **Cofre secreto**: `Ctrl/Cmd + Shift + K` ou 3 toques rápidos no logo. Segunda senha, chave própria, store separado no IndexedDB; não aparece na timeline nem na busca.
- **Editor Markdown** com barra de formatação, visualização, tags e selos (#conquista, #superacao, #inesquecivel), categorias Pessoal / Estratégico.
- **Ditado por voz** (Web Speech API, pt-BR): indicador de gravação, pausar/continuar, limpar o que foi ditado.
- **Tarefas e rotinas** com horário HH:MM:SS, cronômetro por tarefa e checklist de status.
- **Mood tracker**: 9 humores + nível de energia 1–5 no fim de cada entrada.
- **Cofre de fotos**: até 3 por dia, redimensionadas e cifradas antes de ir ao IndexedDB.
- **Ciclo anual**: cada volume é uma "Edição AAAA". Quando o ano vira, o diário fica somente leitura até baixar o livro em PDF e o backup JSON cifrado; só então libera a próxima edição. Backups podem ser restaurados.
- **Retrospectiva**: estatísticas do ano, gráfico emocional mensal (humor médio + nº de registros) e as três colunas de selos.
- **6 temas** (Escuro, Claro, Feminino, Masculino, Infantil, Business) e **6 fontes** (Inter, Merriweather, Playfair Display, Caveat, Dancing Script, JetBrains Mono).
- Toasts, som sutil e vibração ao desbloquear, salvar e concluir tarefas.

## Segurança

- Uma chave de dados AES-GCM 256 aleatória cifra entradas e fotos. Ela é embrulhada por uma chave derivada do PIN/senha (PBKDF2-SHA256, 310 mil iterações) e, opcionalmente, pela PRF do WebAuthn.
- Só `id` e ano ficam em claro no IndexedDB (para apagar o volume encerrado).
- Um PIN de 4 a 6 dígitos é fraco contra quem copiar o IndexedDB e atacar offline. Para proteção forte, use a opção "Senha master".
- Esqueceu o PIN/senha = dados irrecuperáveis. Mantenha backups.

## Estrutura

```
src/lib/crypto.ts      Web Crypto: PBKDF2, AES-GCM, embrulho de chaves
src/lib/webauthn.ts    Cadastro/uso de biometria com PRF
src/lib/db.ts          Wrapper do IndexedDB
src/lib/vault.ts       Tranca, cofre secreto, entradas, fotos, volumes
src/lib/export.ts      PDF em formato de livro (jsPDF) e backup JSON cifrado
src/components/        App, tela de bloqueio, editor, timeline, retrospectiva, ciclo, ajustes
public/sw.js           Service worker (offline)
```
