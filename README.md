# Translatorvg

Versão GitHub Pages do tradutor.

## O que esta versão cobre

- tradução de texto no navegador;
- auto-detect de idioma de origem;
- troca de idiomas;
- histórico local;
- pares favoritos;
- cópia e leitura em voz alta;
- tradução via API pública MyMemory, sem backend próprio.

## Como usar

Abra `index.html` em um servidor estático ou publique a pasta no GitHub Pages.

A tradução usa a API pública [MyMemory](https://mymemory.translated.net/). O
indicador de status na barra superior mostra se o provedor está respondendo.

## Deploy

O repositório está preparado para GitHub Pages via GitHub Actions.

## Observação de arquitetura

Esta versão foi desenhada para funcionar sem backend próprio. Isso a torna
compatível com GitHub Pages, mas deixa o provedor de tradução (MyMemory) como
dependência externa.
