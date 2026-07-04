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
- [x] **Reduzir o espaço vazio no topo** da tela inicial — painel inicial compactado, composer oculto quando não há conversa aberta e ajuste validado em desktop/mobile. Commit `<fase1-home-polish>`.
- [x] **Unificar a saudação** — cabeçalho fica como "Central de conversas" e o card inicial usa "Painel inicial", evitando repetir a marca do menu lateral. Commit `<fase1-home-polish>`.
- [ ] **Logo real do cartório** no avatar e cor de marca — ⏳ depende de receber o arquivo do logo (hoje há só o monograma "DC" em SVG).

## Fase 2 — Experiência de uso (médio risco) 🟡

- [ ] **Validar layout no celular (PWA)** — primeira passada feita na tela inicial: menu e painel não estouram largura, e o composer some sem conversa aberta. Resta compactar a tela de conversa no celular, porque cabeçalho + composer ainda deixam pouca área para mensagens.
- [x] **Indicador de status da conexão** — aviso discreto ("Reconectando...") no cabeçalho quando o socket cai. Commit `88d00e8`.
- [ ] **Confirmação de entrega/leitura** mais clara nas mensagens (checks).
- [x] **Atalhos de teclado** para as respostas rápidas (Alt+1 Verificando / Alt+2 Pedir detalhes / Alt+3 Resolvido / Alt+4 Encaminhar). Commit `88d00e8`.
- [ ] **Acessibilidade** — revisar contrastes restantes e navegação por teclado (WCAG AA).

## Fase 3 — Confiabilidade e escala (médio/alto risco) 🟡🔴

- [ ] **Migrar mensagens para SQLite** — hoje tudo vive num `mensagens.json` carregado em memória; conforme cresce, backup/flush ficam pesados. O projeto já tem um `chat.db`. Alternativa: Postgres do Railway. **Maior ganho estrutural.** Fazer com cuidado: script de migração dos JSONs → banco, manter compatibilidade.
- [ ] **Arquivamento de mensagens antigas** (caso não migre para banco já) — mover conversas muito antigas para arquivos separados, mantendo o JSON ativo enxuto.
- [ ] **IDs únicos também para usuários/grupos** (mesmo padrão crescente) — colisão é rara, mas vale padronizar.
- [ ] **Confirmar `SECRET_KEY` forte e fixa no Railway** — o servidor avisa no boot se não estiver setada (tokens JWT ficam previsíveis sem ela).

## Fase 4 — Recursos novos (em blocos pequenos)

Implementação em blocos isolados, cada um = 1 commit testado.

**Bloco A — Push** ✅ (código já estava pronto)
- [x] **Push real** — gerar chaves VAPID. Falta apenas configurar `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` no Railway e redeployar.

**Bloco B — Mídia & exportação** ✅
- [x] **Galeria de mídia da conversa** — grid de imagens/vídeos/PDFs (botão "Galeria" no menu Mais).
- [x] **Exportar conversa em PDF** — via impressão do navegador (botão "Exportar PDF"). Mantido o TXT.

**Bloco C — Atendimento (notas + etiquetas)** ✅
- [x] **Notas internas** numa conversa (visíveis só p/ equipe). Commit `<workflow-all>`.
- [x] **Etiquetas por tipo de serviço** (registro civil, PJ, protesto, certidão...). Commit `<workflow-all>`.

**Bloco D — Atendimento (responsável + SLA)** ✅
- [x] **Atribuir responsável** ao atendimento. Commit `<workflow-all>`.
- [x] **Alerta de pendência/SLA** (pendente/aguardando/urgente sem atualização recente). Commit `<workflow-all>`.

**Bloco E — Comunicação** ✅
- [x] **@menções** com notificação. Commit `<workflow-all>`.
- [x] **"Visto por" em grupo** (expor `leituras_grupo`). Commit `<workflow-all>`.

**Bloco F — Agendamento + métricas** ✅
- [x] **Mensagens agendadas / rascunho**. Commit `<workflow-all>`.
- [x] **Métricas avançadas** — tempo médio de resposta, volume por dia, ranking e etiquetas mais usadas. Commit `<workflow-all>`.

**Para o futuro (a combinar):** busca melhor, resumo por e-mail / "não perturbe", som por tipo, 2FA, retenção/expiração e exportação LGPD, número de protocolo na conversa, mensagens de voz.

---

> Dica de processo: fazer 1–2 itens por vez, publicar (`git push` na `main` dispara
> o deploy no Railway) e validar em produção antes de seguir. Sempre que mexer em
> dados, conferir que o backup automático está ativo.
