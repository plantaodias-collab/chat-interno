# Roadmap de Melhorias — Chat Interno

Lista de evoluções para fazer **aos poucos, sem quebrar o app**. Cada item tem
esforço (🟢 baixo / 🟡 médio / 🔴 alto) e risco de quebrar algo.
Ordem sugerida: de cima para baixo.

---

## ✅ Já feito

- [x] **Atraso entre mensagens** — gravação em disco assíncrona com debounce + escrita atômica (antes reescrevia todos os JSONs de forma síncrona a cada mensagem). Commit `dfeb456`.
- [x] **Mensagens sumindo após queda de conexão** — front resincroniza a conversa aberta ao reconectar o socket. Commit `dfeb456`.
- [x] **Flush no SIGTERM/backup** — não perde mensagens em redeploy/reinício no Railway. Commit `dfeb456`.
- [x] **19 caracteres quebrados (mojibake)** nas mensagens de erro do servidor. Commit `f840c21`.
- [x] **IDs de mensagem com colisão** (`Date.now()`) → `gerarIdMensagem()` crescente. Commit `f840c21`.
- [x] **Acentos da tela inicial** (Cartório, atenção, não lidas...). Commit `f840c21`.
- [x] **Contraste dos rótulos** dos cards de estatística. Commit `f840c21`.

---

## Fase 1 — Polimento visual (baixo risco, alto retorno) 🟢

- [x] **Acentuação** — frases do dia (caixa verde), abas do admin (Usuários, Métricas), Painel Público, toasts ("Arquivo inválido", "indisponível", "Impressão"...) e tela inicial. Commit `<fase1>`. *(Resta uma varredura fina de strings menos visíveis, que dá para fazer aos poucos.)*
- [x] **Cards de estatística com hierarquia** — contagem 0 fica apagada; "não lidas/pendentes/urgentes" > 0 ganham cor de alerta (azul/âmbar/vermelho). Commit `<fase1>`.
- [ ] **Reduzir o espaço vazio no topo** da tela inicial — ⚠️ requer ajuste visual com o app rodando para acertar sem quebrar o layout (CSS bem duplicado). Fazer iterando com o render.
- [ ] **Unificar a saudação** — hoje a marca "Cartório Dias de Castro" aparece no cabeçalho e no card. ⚠️ decisão visual; fazer vendo o resultado.
- [ ] **Logo real do cartório** no avatar e cor de marca — ⏳ depende de receber o arquivo do logo (hoje há só o monograma "DC" em SVG).

## Fase 2 — Experiência de uso (médio risco) 🟡

- [ ] **Validar layout no celular (PWA)** — o plantão provavelmente usa no celular. Testar a sidebar e o composer em telas pequenas; já existe `manifest.json` + `sw.js`.
- [ ] **Indicador de status da conexão** — um aviso discreto ("Reconectando...") quando o socket cai, para o usuário saber que mensagens podem estar atrasadas.
- [ ] **Confirmação de entrega/leitura** mais clara nas mensagens (checks).
- [ ] **Atalhos de teclado** para as respostas rápidas (Verificando / Pedir detalhes / Resolvido).
- [ ] **Acessibilidade** — revisar contrastes restantes e navegação por teclado (WCAG AA).

## Fase 3 — Confiabilidade e escala (médio/alto risco) 🟡🔴

- [ ] **Migrar mensagens para SQLite** — hoje tudo vive num `mensagens.json` carregado em memória; conforme cresce, backup/flush ficam pesados. O projeto já tem um `chat.db`. Alternativa: Postgres do Railway. **Maior ganho estrutural.** Fazer com cuidado: script de migração dos JSONs → banco, manter compatibilidade.
- [ ] **Arquivamento de mensagens antigas** (caso não migre para banco já) — mover conversas muito antigas para arquivos separados, mantendo o JSON ativo enxuto.
- [ ] **IDs únicos também para usuários/grupos** (mesmo padrão crescente) — colisão é rara, mas vale padronizar.
- [ ] **Confirmar `SECRET_KEY` forte e fixa no Railway** — o servidor avisa no boot se não estiver setada (tokens JWT ficam previsíveis sem ela).

## Fase 4 — Recursos novos (quando o básico estiver redondo) 🟡

- [ ] **Busca melhor** — diferenciar visualmente "Buscar na conversa" de "Global".
- [ ] **Notificações push** — já há `web-push` no projeto; configurar as chaves VAPID (hoje o boot avisa "Push desativado").
- [ ] **Histórico/exportação** de conversas para fins de registro.
- [ ] **Métricas simples** — quem está mais ativo, tempo de resposta médio, para gestão.

---

> Dica de processo: fazer 1–2 itens por vez, publicar (`git push` na `main` dispara
> o deploy no Railway) e validar em produção antes de seguir. Sempre que mexer em
> dados, conferir que o backup automático está ativo.
