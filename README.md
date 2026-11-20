# Timer Plus

Timer de treino HIIT/Tabata para **celular, tablet e Android** (instalação por APK / fontes desconhecidas).

## Baixar o APK (tablet / celular)

> O repositório no GitHub está **privado**. Por isso o link do GitHub **não baixa** em outro celular sem login.

### Forma fácil de compartilhar

Use a página pública `/baixar.html` do app publicado no Cursor (escolha visibilidade **Public**).  
No celular: abra o link → **BAIXAR APK** → instalar.

### Se quiser usar o GitHub

Deixe o repo público:  
https://github.com/gabrielmarsaro/timer-plus/settings → Danger Zone → Change visibility → Public.

Depois este link funciona em qualquer aparelho:  
https://github.com/gabrielmarsaro/timer-plus/raw/main/releases/timer-plus-debug.apk

### Instalar no Android

1. Baixe o APK no Chrome.
2. Abra o arquivo.
3. Permita **fontes desconhecidas** se pedir.
4. Instale / atualize.

## Rodar no navegador

```bash
npm install
npm run dev
```

## Gerar o APK de novo

Requisitos: **JDK 17+** e **Android SDK**.

```bash
npm install
npm run android:apk
```

Arquivo gerado: `android/app/build/outputs/apk/debug/app-debug.apk`

## Layout

| Dispositivo | Comportamento |
|-------------|---------------|
| Celular | UI compacta, números grandes, alto contraste |
| Tablet | Tipografia maior, blocos com respiro |
| Tablet landscape | Fase atual e próxima **lado a lado** |

## Scripts

| Comando | Função |
|---------|--------|
| `npm run dev` | Servidor web local |
| `npm run build` | Build web (`dist/`) |
| `npm run cap:sync` | Build + sincroniza Capacitor Android |
| `npm run android:apk` | Gera o APK debug |
| `npm run smoke` | Teste rápido start/pause (Playwright) |

## Estrutura

- `src/` — app React (Tabata, settings, navegação)
- `android/` — projeto nativo Capacitor
- `releases/` — APK pronto para instalar
- `capacitor.config.ts` — id `com.timerplus.app`
