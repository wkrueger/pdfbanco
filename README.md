# pdf bb

Script sujo pra extrair dados de um extrato PDF do Banco do Brasil.

**Requisitos:** Node.js

## Executando

 - Criar uma pasta `files`. Mover os PDFs para esta.
 - `yarn`
 - `node dist/index.mjs`
 - O resultado é salvo como um TSV (Tab Separated Values) na pasta `result`.

## Editando o código

Ative o compilador typescript `yarn tsc -w`.