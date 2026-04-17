# Railway

Para manter os dados do chat no Railway sem perder mensagens, nomes ou grupos em reinicios:

1. Adicione um volume persistente ao servico.
2. Use o mount path `/app/storage`.
3. Configure a variavel `STORAGE_ROOT=/app/storage`.
4. Configure uma `SECRET_KEY` forte e fixa.
5. Use `/health` como healthcheck.

Com essa configuracao:

- os JSONs ficam em `/app/storage/data`
- os anexos ficam em `/app/storage/uploads`
- o app para de usar storage efemero

Se `STORAGE_ROOT` e `RAILWAY_VOLUME_MOUNT_PATH` nao estiverem definidos, o servidor ainda sobe, mas os dados podem se perder em reinicios do container.
