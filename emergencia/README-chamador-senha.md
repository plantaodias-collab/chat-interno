# Chamador de senha

Sistema simples para uso emergencial no navegador, pensado para substituir temporariamente a maquina de senhas.

## Como iniciar

1. Clique duas vezes em `iniciar-chamador.bat`.
2. O painel de controle abre em `http://127.0.0.1:8091/`.
3. O painel publico abre em `http://127.0.0.1:8091/painel.html`.

## Como usar

1. Use `Gerar nova senha` para emitir a proxima senha sequencial.
2. Escolha o guiche e clique em `Chamar proxima senha`.
3. O painel publico atualiza sozinho na outra aba ou monitor.

## Observacoes

- Os dados ficam salvos no navegador via `localStorage`.
- A fila segue ordem sequencial simples.
- O botao `Zerar atendimento` reinicia a numeracao e limpa a fila.
- Para parar o sistema, feche a janela do PowerShell aberta pelo iniciador.
