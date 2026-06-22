# Translatorvg

Versão GitHub Pages do tradutor.

## O que esta versão cobre

- tradução de texto no navegador;
- auto-detect de idioma de origem;
- troca de idiomas;
- histórico local;
- pares favoritos;
- cópia e leitura em voz alta;
- endpoint configurável para usar uma instância pública de tradução.

## Como usar

Abra `index.html` em um servidor estático ou publique a pasta no GitHub Pages.

Se uma instância pública falhar, troque o endpoint na barra superior.

## Deploy

O repositório está preparado para GitHub Pages via GitHub Actions.

## Observação de arquitetura

Esta versão foi desenhada para funcionar sem backend próprio. Isso a torna
compatível com GitHub Pages, mas deixa o provedor de tradução como dependência
externa.
