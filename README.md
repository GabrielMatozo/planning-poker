# Planning Poker

Estimativa de histórias em tempo real e sem cadastro. Alguém cria a sala e manda o link. Cada pessoa escolhe uma carta sem revelar o valor, o host abre a rodada e o grupo vê média, mediana, consenso e distribuição.

O estado fica no Firebase Realtime Database. As regras do banco garantem o sigilo do voto: mesmo com o DevTools aberto, ninguém lê o voto do outro antes do reveal.

## Requisitos

Node 22 ou mais novo. Java 17 ou mais novo, porque o emulador do Realtime Database roda em JVM.

## Rodando local

```bash
npm install
npm run dev:all
```

Sobe três processos:

| Serviço | Endereço |
|---|---|
| App (Vite) | http://localhost:5173 |
| Realtime Database (emulador) | 127.0.0.1:9000 |
| Auth (emulador) | 127.0.0.1:9099 |

O projectId é `demo-planning-poker`. Nada sai da máquina e não precisa de conta Google.

Se quiser separar os processos:

```bash
npm run dev:emu   # só os emuladores
npm run dev       # só o Vite
```

## Testes

```bash
npm test                        # unidade e componente (jsdom)
FIREBASE_EMULATOR=1 npm test    # inclui provider e presença
npm run rules:test              # regras do RTDB por REST, exige emulador
npm run e2e                     # Playwright, 15 testes multi-contexto
```

O E2E reproduz o caso que mais dói na prática: F5 em uma aba e o nome continua na lista da outra, sem duplicata, com host e voto preservados.

## Segurança

O modelo de ameaça, os headers de produção e o checklist de deploy estão em [SECURITY.md](./SECURITY.md).

As regras do RTDB negam leitura de voto alheio, troca de host com o host online, escrita em sala inexistente, voto forjado e carta fora do deck. `npm audit --omit=dev` fecha em zero.

## Estrutura

```
src/types/room.ts        contrato da sala, deck e estatísticas
src/lib/                 funções puras (stats, presença, ids)
src/data/firebase/       provider real: Auth anônimo + RTDB
src/data/mock/           provider em memória para UI e testes
src/app/room-context.ts  única porta que a UI conhece
src/ui/                  design system
src/features/            home e sala
src/routes/              rotas
database.rules.json      regras do banco
```

A UI não importa `firebase/*` nem `src/data/*`. Trocar de backend significa implementar outro `RoomProvider`, sem mexer nas telas.

### Presença

`signInAnonymously` dá um uid estável entre refresh e reconexão. `presence/{uid}` guarda nome, cor, `online`, `lastSeen`, `joinedAt` e `hasVoted`. O cliente bate heartbeat a cada 15s, inclusive em aba oculta, marca offline via `onDisconnect` e se registra de novo a cada reconexão. Quem fica offline por mais de 60s aparece como offline; sem voto e offline por 5 minutos sai da lista.

Se o host some por 60s, o primeiro membro online que reivindicar assume por transação. O cliente tenta priorizar quem entrou antes, mas o servidor não consegue provar isso sem uma Cloud Function: para o banco, vale o primeiro que reivindica depois da janela.

### Voto oculto

`votes/{uid}` é privado até `meta/revealed === true`. A lista de participantes mostra apenas "votou" ou "aguardando", lido de `presence.hasVoted`. Não existe caminho de leitura de voto alheio antes do reveal, nem pelo DevTools nem por REST.

### Histórico de médias

A média de cada rodada fica em `meta/history/{round}`, gravada pelo host quando ele vê a rodada revelada. Todo mundo lê a mesma lista, ela volta igual depois de F5 e quem entra na rodada 5 recebe as anteriores. As regras só aceitam escrita do host com o reveal ativo e chave de rodada válida. O host poda as mais antigas acima de 50.

## Produção

Rodando em https://planning-poker-deck.web.app (projeto Firebase `planning-poker-deck`).

O build lê `.env.production`. Em `npm run dev` o app usa o emulador; em `vite build` usa o projeto real. `src/data/firebase/client.ts` decide pelo `VITE_FIREBASE_*`.

```bash
npm run build
firebase deploy --only hosting,database
```

Antes do deploy, precisa existir no console:

1. Authentication com o provedor Anonymous ativo.
2. Realtime Database criado (`planning-poker-deck-default-rtdb`).
3. `.firebaserc` com o project ID e `.env.production` com a config do app web.

O `databaseURL` precisa terminar com o namespace default (`...?ns=<projeto>-default-rtdb`). O emulador do CLI aplica as regras apenas nesse namespace.

## QA visual

`node scripts/qa.mjs` cria uma sala com cinco pessoas, vota, revela e salva capturas em `docs/design/` nos três viewports. Exige `npm run dev:all` rodando.

## Fora de escopo

Backlog de histórias, import/export, número de task, contas reais, TTL automático de sala vazia e notificações.
