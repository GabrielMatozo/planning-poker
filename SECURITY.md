# Segurança

Documento curto e direto sobre o que este app garante, o que não garante e por quê.

## Modelo de ameaça

O adversário é um participante com o link da sala, conta anônima própria e DevTools aberto.
Ele pode: ler o bundle, ver o próprio token, chamar o Realtime Database direto por HTTP/WebSocket,
escrever qualquer caminho que as regras permitam e automatizar requisições.

Fora do escopo: ataque de rede (TLS é do Firebase), comprometimento da conta Google do projeto,
engenharia social e negação de serviço volumétrica (tratada em produção, ver checklist).

## "Bloquear DevTools" não existe, mas dá para atrapalhar

Não é possível impedir DevTools em um app web. Atalho bloqueado se contorna com outro navegador,
perfil limpo, `--auto-open-devtools-for-tabs`, proxy ou `curl`. Detecção por tamanho de janela ou
`debugger` é falsa sensação de segurança, quebra acessibilidade e não resiste a 30 segundos de
tentativa: `Ctrl+F8` desativa breakpoints, abrir o DevTools antes do load evita o loop, e o banco
continua acessível por REST com o token da própria sessão.

O projeto tem uma camada de **dissuasão** em `src/app/anti-debug.ts`, desligada em dev/test:

- `strict` (padrão em produção): bloqueia F12, Ctrl+Shift+I/J/C/K, Ctrl+U e variantes do macOS,
  e roda `debugger` a cada 250ms. Com o DevTools aberto o navegador pausa sem parar.
- `shortcuts`: só o bloqueio de atalhos.
- `0`: desligado.

Escape para suporte/QA: abrir a URL com `?pp_debug=1` (vale para a sessão).
`VITE_ANTI_DEBUG=0` desliga no build inteiro.

Isso é cosmético e tem custo: quem abre DevTools de boa-fé (para reportar bug) vê a página travar.
A proteção real continua sendo o servidor: **mesmo com DevTools aberto e sem dissuasão, o
participante não consegue nada que as regras não permitam**.

## Garantias no servidor (database.rules.json)

Cada item abaixo tem teste em `rules-tests/rules.test.ts`.

| Garantia | Como é imposta |
| --- | --- |
| Ninguém lê o voto de outro antes do reveal | `votes/$uid/.read` só libera o próprio voto ou tudo quando `meta.revealed === true` |
| Voto não pode ser trocado depois do reveal | escrita em `votes/$uid` exige `revealed !== true` |
| Só o host revela e inicia rodada | escrita em `meta/revealed`, `meta/round`, `meta/autoReveal`, `meta/name` exige `hostId === auth.uid` |
| Ninguém rouba o host com o host online | troca de `hostId` exige que o host atual esteja ausente ou com `lastSeen` mais velho que 60s (`now` do servidor) |
| Ninguém cria presença em sala inexistente | presença exige `meta` existente (na criação, o mesmo write atômico) |
| Não dá para forjar "votou" | `hasVoted: true` exige que `votes/$uid` já exista no servidor |
| Carta fora do deck é recusada | `value` validado por regex contra o deck fixo |
| Sala só nasce com host válido | criação exige `newData.meta.hostId === auth.uid` e `!data.exists()` |
| Sala existente não pode ser sobrescrita | escrita no nó da sala só vale na criação |
| Código de sala fora do alfabeto é recusado | `$roomId.matches(/^[23456789abcdefghjkmnpqrstuvwxyz]{6}$/)` |
| Campos desconhecidos são recusados | `$other` com `.validate: false` em `meta`, `presence/$uid` e `votes/$uid` |
| Presença só no próprio uid | `auth.uid === $uid` |
| Leitura exige autenticação | `auth != null` em `meta` e `presence`; sem sessão, 401 |
| Votos alheios só o host limpa ao virar rodada | deleção em `votes/$uid` exige `hostId === auth.uid` |
| Histórico de médias só o host grava, e só com a rodada revelada | `meta/history/$round` exige `hostId === auth.uid` e `meta.revealed === true`; chave casa `^[1-9][0-9]{0,3}$` e valor entre 0 e 999 |

Limite estrutural: as regras não fazem rate limit nem contagem de salas. Isso é papel do App Check
e de Cloud Functions/quotas em produção.

## Headers de segurança (firebase.json)

Aplicados no Hosting (produção), não no dev server do Vite:

- CSP com `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'none'`,
  `form-action 'self'`; `connect-src` restrito a Firebase Auth/RTDB e reCAPTCHA.
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` sem câmera, microfone, geolocalização, pagamento, USB
- `Strict-Transport-Security` por um ano
- `Cross-Origin-Opener-Policy` e `Cross-Origin-Resource-Policy` em `same-origin`
- assets com hash: cache imutável; `index.html`: sem cache

O único `unsafe-inline` é em `style-src`, necessário porque componentes usam `style` para largura
de barra e cor de avatar. Não há `unsafe-inline` em `script-src` nem `unsafe-eval`.

## Cliente

- Nenhum `dangerouslySetInnerHTML`, `innerHTML`, `eval` ou `new Function`.
- Nome e código da sala são normalizados e limitados (1 a 40 caracteres; 6 caracteres do alfabeto).
- Nome exibido vem sempre da presença no servidor: se a escrita falhou, a tela pede entrada de
  novo em vez de deixar a pessoa "invisível" votando.
- O `apiKey` do Firebase é público por design; a segurança não depende dele.

## Limites conhecidos

1. **Auth anônima**: uid estável, sem senha. Não há como recuperar conta nem provar identidade.
2. **Sem TTL de sala**: salas ficam no banco até alguém apagar. Em produção, agende limpeza.
3. **Sem rate limit no cliente**: um script pode criar salas em série. App Check + quotas resolvem.
4. **Duas abas com o mesmo uid**: a presença pode oscilar por até 15s (um `onDisconnect` marca
   offline enquanto a outra aba ainda está viva).
5. **Aba do host em segundo plano**: o timer é estrangulado pelo navegador; o heartbeat agora bate
   também em aba oculta, mas em casos extremos o host pode ser assumido após 60s.
6. **CSP só vale no Hosting**: `npm run dev` não aplica headers.
7. **Metadados da sala**: quem tem o código e uma sessão autenticada consegue ler nome da sala e
   lista de participantes (nunca os votos). O código de 6 caracteres não é listável, mas também não
   é segredo forte. Para sigilo real, use códigos mais longos ou uma Cloud Function de entrada.
8. **Arbitragem de host**: passados 60s sem heartbeat, o primeiro membro que reivindicar vira host.
   O cliente tenta priorizar quem entrou antes, mas o servidor não consegue provar senioridade sem
   enumerar a presença (Cloud Function). Um membro malicioso pode assumir nessa janela.
9. **Emulador não é fronteira de segurança**: o RTDB emulator aceita `?access_token=` de qualquer
   valor e reflete qualquer `Origin`. Ele escuta só em 127.0.0.1 e nunca deve ser exposto na rede.
   Testes de regra sem `auth=` não provam nada; os testes deste repo sempre autenticam.
10. **Voto x reveal**: um voto enviado no exato instante do reveal pode ser recusado (`PERMISSION_DENIED`).
    A UI traduz para "a rodada foi revelada" em vez de vazar erro técnico; não há retry automático
    porque o voto perderia a validade de qualquer forma.
11. **DoS por criação de salas**: rate limiter no cliente (localStorage) bloqueia 5 salas por minuto
    e 20 por hora por uid. Desligado em dev com `VITE_QUOTA_DISABLED=1`. Em produção, App Check
    no console do Firebase bloqueia requisições sem token válido, protegendo o servidor.

## Checklist de produção

1. Criar projeto Firebase real e configurar `VITE_*` (hoje o cliente aponta para o emulador).
2. Ativar **App Check** com reCAPTCHA v3/Enterprise e **enforce** em Auth e Realtime Database.
   Isso impede que scripts externos criem salas ou acessem o banco, o que fecha o DoS de verdade.
3. Definir quotas e alertas de orçamento no Google Cloud.
4. Cloud Function agendada para apagar salas com `lastActivityAt` antigo.
5. Rate limit por uid em Cloud Function (criação de sala e escrita de voto), se necessário.
6. `firebase deploy --only hosting,database`. Os headers e as regras vão junto.
7. Rodar `npm run rules:test` e `npm run e2e` contra o projeto antes de abrir para o time.

## Como verificar

```bash
npm test                     # unidade e integração
npm run rules:test           # ataques contra as regras (precisa do emulador)
npx playwright test          # fluxo real no navegador
npm audit --omit=dev         # dependências que vão para o bundle
```

`npm audit` completo ainda acusa pacotes **dev-only** do `firebase-tools`. Eles não entram no
bundle nem no Hosting.
