# Handoff do Planning Poker

Data: 2026-10-24
Repo: `~/Projetos/Pessoais/planning-poker`
Produção: https://planning-poker-deck.web.app (projeto Firebase `planning-poker-deck`)

## Deploy

`npm run build` lê `.env.production`. `firebase deploy --only hosting,database` publica app e regras.

Smoke test em produção: auth anônimo, criação de sala, entrada por código, dois votos, reveal com média 4 e zero erro de console. A CSP não bloqueia nada do Firebase.

Ainda não configurado em produção: App Check (proteção server-side contra criação de salas em massa) e TTL de sala vazia. Hoje só dá para apagar sala com `firebase database:remove` e credencial de admin.

## O que está pronto

| Área | Estado |
|---|---|
| Identidade | Auth anônimo, uid estável entre refresh e reconexão |
| Presença | heartbeat de 15s, `onDisconnect`, janela de 60s, remoção após 5 min offline sem voto |
| Host | transferência em transação para o primeiro online que reivindicar depois de 60s. O cliente prioriza quem entrou antes; o servidor não consegue provar senioridade sem Cloud Function |
| Votação | deck `0 1 2 3 5 8 13 21 ? ☕`, troca livre até o reveal |
| Reveal | média, mediana, consenso, distribuição e cartas de todos no palco |
| Histórico | média por rodada em `meta/history/{round}`, igual para todos, sobrevive a F5 e entrada tardia |
| Nova rodada | limpa votos, mantém presença, incrementa a rodada |
| Voto oculto | `votes/{uid}` ilegível para os outros até `revealed === true` |
| Entrada por link | gate de nome quando não há nome salvo |
| Kick | host remove participante; quem foi removido vê a tela de bloqueio e pode voltar com outro nome |
| Visual | dark com um acento âmbar, Inter e JetBrains Mono |
| Acessibilidade | axe AA sem violações em home, gate e sala com reveal |
| Segurança | regras contra roubo de host, squatting de sala e voto forjado; CSP e headers no Hosting; `npm audit --omit=dev` zerado |
| Mobile | 390px sem overflow, deck na zona do polegar |

## Como validar manualmente

1. `npm run dev:all` e abra http://localhost:5173
2. Crie uma sala ("Sprint 42" e seu nome).
3. Copie o link do header e abra em uma janela anônima: deve pedir o nome e entrar.
4. Vote em uma aba e confira que a outra mostra "votou" sem revelar o valor.
5. Dê F5 na aba do host: o outro lado continua vendo o mesmo nome, uma única vez, e o host segue host.
6. Revele: média, mediana, distribuição e as cartas de todos aparecem.
7. Feche a aba do host: depois de cerca de 60s o comando passa para o outro participante.
8. Nova rodada: votos limpos, todos continuam na sala.
9. Abra `/r/zzzzzz`: tela de sala não encontrada, sem quebrar.
10. Com duas pessoas na sala, o host expulsa uma pela lista de participantes. A pessoa expulsa vê a tela de bloqueio.

## Verificação executada

```
npm test             218 passed, 81 skipped
npm run rules:test    50 passed
npm run build         ok
```

Os 81 testes pulados dependem do emulador (`FIREBASE_EMULATOR=1 npm test`). O E2E do Playwright não foi reexecutado nesta rodada; o comando é `npm run e2e`.

## Decisões que valem saber

- **Namespace do RTDB**: `?ns=demo-planning-poker-default-rtdb`. Com o namespace curto, o CLI do emulador não aplica as regras e a suíte de regras vira decorativa.
- **Criação de sala sem transação**: `serverTimestamp` não combina com `runTransaction`. A atomicidade vem da regra (só cria nó inexistente com `hostId === auth.uid`) e o cliente tenta outro código em caso de colisão.
- **Host**: a transferência é imposta no servidor. A regra só aceita `hostId` novo se o host atual não existe na presença ou está com `lastSeen` mais velho que 60s (`now` do servidor).
- **`hasVoted` em `presence`**: é o que permite mostrar "votou" sem abrir `votes`. A regra exige que o voto já exista no servidor para aceitar `hasVoted: true`.
- **`castVote` em duas escritas**: voto primeiro, flag depois. A regra de `hasVoted` consulta o estado já gravado. Um efeito de reconciliação religa a flag se a segunda escrita falhar.
- **Presença exige sala existente**: sem isso, um write em `presence` criava o nó da sala e bloqueava a criação do código de verdade (squatting).
- **`newRound` apaga voto uid por uid**: `votes: null` no pai é negado pelas regras.
- **Histórico de médias**: `meta/history/{round}` no banco, gravado pelo host ao ver a rodada revelada. A regra exige reveal ativo. O host poda em 50 rodadas. O cliente só deriva (`deriveHistory`), não acumula estado local.
- **Kick**: a regra permite ao host remover a presença de qualquer participante. O cliente marca o uid removido e mostra a tela de bloqueio; voltar com outro nome é permitido.

## O que ficou de fora

- Backlog de histórias, import/export e número de task (pedido explícito).
- TTL de sala vazia. Salas ficam no banco até alguém apagar; em produção vale uma Cloud Function de limpeza.
- Code-splitting do SDK Firebase (chunk de ~540 kB, só aviso de build).
- Contas reais. Qualquer pessoa com o link entra, o que basta para uso interno.
- App Check. Só faz sentido com projeto real e reCAPTCHA configurado. O passo a passo está no `SECURITY.md`.
- Bloqueio de DevTools. Não existe em app web; a proteção real é server-side, descrita no `SECURITY.md`.

## Próximo passo sugerido

Configurar App Check e uma rotina de limpeza de salas antes de abrir para mais gente. Depois, rodar uma sprint real com o time para calibrar o gate de nome e o tom dos avisos.
